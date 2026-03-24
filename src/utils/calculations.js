/**
 * Fonction utilitaire pour convertir les nombres avec séparateurs décimaux (format suisse)
 */
export const parseDecimal = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  
  // Si la chaîne est vide, retourner 0
  if (value.trim() === '') return 0;
  
  // Format suisse : point décimal, pas de séparateur de milliers
  // On accepte les virgules comme séparateurs décimaux (habitude utilisateur)
  // "7.5" -> 7.5, "7,5" -> 7.5, "52037" -> 52037
  // "52'037" -> 52037 (supprime apostrophe), "52 037" -> 52037 (supprime espace)
  
  // Remplacer les virgules par des points (habitude utilisateur)
  let normalized = value.replace(',', '.');
  
  // Supprimer les apostrophes et espaces (séparateurs de milliers parfois utilisés)
  normalized = normalized.replace(/['’\s]/g, '');
  
  // Supprimer tout ce qui n'est pas chiffre, point ou signe négatif
  const cleaned = normalized.replace(/[^\d.-]/g, '');
  
  // Convertir en nombre
  const num = parseFloat(cleaned);
  
  // Retourner 0 si NaN, sinon le nombre
  return isNaN(num) ? 0 : num;
};

/**
 * Fonction pour formater l'affichage avec le séparateur approprié (point pour la Suisse)
 */
export const formatDecimal = (value, decimals = 2) => {
  const num = typeof value === 'number' ? value : parseDecimal(value);
  return num.toFixed(decimals); // Utilise le point comme séparateur décimal
};

/**
 * Moteur de calcul principal pour les résultats TCO
 * Retourne un tableau de résultats pour chaque véhicule
 */
export const calculateResults = (cars, settings) => {
  const {
    dureeMois,
    kmAnnuel,
    parking,
    vignette,
    tauxCreditGlobal,
    inflationAnnuelle,
    tauxPlacement,
    prixEssence,
    prixElec,
    ratioElec,
    dureeDetention
  } = settings;

  return cars.map(car => {
    // A. Coût Énergie Mensuel (adapté au type de motorisation)
    const distMensuelle = kmAnnuel / 12;
    let coutEnergieMensuel = 0;
    
    switch (car.motorisation) {
      case 'ICE': // Thermique
        coutEnergieMensuel = (distMensuelle / 100) * car.consoEssence * prixEssence;
        break;
      case 'BEV': // Électrique
        coutEnergieMensuel = (distMensuelle / 100) * car.consoElec * prixElec;
        break;
      case 'PHEV': // Hybride Rechargeable
      default:
        coutEnergieMensuel = (
          (distMensuelle * (ratioElec / 100) / 100 * car.consoElec * prixElec) +
          (distMensuelle * (1 - ratioElec / 100) / 100 * car.consoEssence * prixEssence)
        );
        break;
    }

    // Valeur résiduelle réelle avec formule de dépréciation long terme
    // PrixAchat * (0.85 ^ (dureeDetention / 12)) * (1 - risqueDepreciation / 100)
    const depreciationFactor = Math.pow(0.85, dureeDetention / 12);
    const valeurResiduelleReelle = car.prixAchat * depreciationFactor * (1 - car.risqueDepreciation / 100);

    // Bonus d'entretien de +20% si durée détention > 60 mois
    const entretienMensuel = car.entretien / 12;
    const entretienAjuste = dureeDetention > 60 ? entretienMensuel * 1.2 : entretienMensuel;

    // Frais Fixes mensuels
    const fraisFixesMensuel = (car.assurance + car.impotCantonal + vignette) / 12 + parking + entretienAjuste;

    // Calculs de base pour chaque mode de financement
    
    // 1. LEASING (durée fixe = dureeMois)
    const capitalFinanceLeasing = car.prixAchat - car.apport;
    const rLeasing = (car.tauxLeasing / 100) / 12;
    let pmtLeasing = 0;
    if (rLeasing > 0) {
      const facteur = Math.pow(1 + rLeasing, -dureeMois);
      const denom = (1 - facteur) / rLeasing;
      pmtLeasing = (capitalFinanceLeasing - (car.valeurResiduelle * facteur)) / (denom * (1 + rLeasing));
    } else {
      pmtLeasing = (capitalFinanceLeasing - car.valeurResiduelle) / dureeMois;
    }

    // 2. CRÉDIT (durée du crédit = dureeMois, détention = dureeDetention)
    const capitalFinanceCredit = car.prixAchat - car.apportCredit;
    const rCredit = (tauxCreditGlobal / 100) / 12;
    let pmtCredit = 0;
    if (rCredit > 0) {
      pmtCredit = capitalFinanceCredit * (rCredit / (1 - Math.pow(1 + rCredit, -dureeMois)));
    } else {
      pmtCredit = capitalFinanceCredit / dureeMois;
    }

    // Calcul des 5 piliers selon les nouvelles formules
    
    // Pilier 1: Banque
    const banqueLeasing = pmtLeasing; // Mensualité brute
    const banqueCredit = (pmtCredit * dureeMois) / dureeDetention; // Lissé sur la durée de détention
    const banqueComptant = 0;

    // Pilier 2: Apport Lissé
    const apportLisseLeasing = Math.max(0, car.apport / dureeMois);
    const apportLisseCredit = Math.max(0, (car.apportCredit - valeurResiduelleReelle) / dureeDetention);
    const apportLisseComptant = Math.max(0, (car.prixAchat - valeurResiduelleReelle) / dureeDetention);

    // Pilier 3: Énergie
    const energie = coutEnergieMensuel;

    // Pilier 4: Frais Fixes
    const fraisFixes = fraisFixesMensuel;

    // Pilier 5: Opportunité (Coût d'opportunité sur capital immobilisé)
    const capitalImmobiliseLeasing = car.apport;
    const capitalImmobiliseCredit = car.apportCredit;
    const capitalImmobiliseComptant = car.prixAchat;
    
    const opportuniteLeasing = (capitalImmobiliseLeasing * tauxPlacement / 100) / 12;
    const opportuniteCredit = (capitalImmobiliseCredit * tauxPlacement / 100) / 12;
    const opportuniteComptant = (capitalImmobiliseComptant * tauxPlacement / 100) / 12;

    // TCO total (moyenne mensuelle sur la durée de détention)
    const tcoLeasing = apportLisseLeasing + banqueLeasing + energie + fraisFixes + opportuniteLeasing;
    const tcoCredit = apportLisseCredit + banqueCredit + energie + fraisFixes + opportuniteCredit;
    const tcoComptant = apportLisseComptant + banqueComptant + energie + fraisFixes + opportuniteComptant;

    // Breakdown pour les graphiques
    const breakdownLeasing = {
      apportLisse: apportLisseLeasing,
      banque: banqueLeasing,
      energie: energie,
      fraisFixes: fraisFixes,
      opportunite: opportuniteLeasing,
      total: tcoLeasing
    };

    const breakdownCredit = {
      apportLisse: apportLisseCredit,
      banque: banqueCredit,
      energie: energie,
      fraisFixes: fraisFixes,
      opportunite: opportuniteCredit,
      total: tcoCredit
    };

    const breakdownComptant = {
      apportLisse: apportLisseComptant,
      banque: banqueComptant,
      energie: energie,
      fraisFixes: fraisFixes,
      opportunite: opportuniteComptant,
      total: tcoComptant
    };

    return {
      ...car,
      coutEnergieMensuel: energie,
      fraisFixesMensuel: fraisFixes,
      fraisUsage: energie + fraisFixes,
      valeurResiduelleReelle,
      leasing: {
        pmt: pmtLeasing > 0 ? pmtLeasing : 0,
        tco: tcoLeasing,
        breakdown: breakdownLeasing
      },
      credit: {
        pmt: pmtCredit > 0 ? pmtCredit : 0,
        tco: tcoCredit,
        breakdown: breakdownCredit
      },
      comptant: {
        tco: tcoComptant,
        breakdown: breakdownComptant
      }
    };
  });
};

/**
 * Calcule la valeur maximale TCO pour l'échelle des graphiques
 */
export const calculateMaxTCO = (results) => {
  return Math.max(...results.map(r => Math.max(r.leasing.tco, r.credit.tco, r.comptant.tco)), 1);
};