// utils/calculations.js

// Fonction utilitaire pour éviter les erreurs NaN lors de la saisie
export const parseDecimal = (value) => {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(String(value).replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
};

// 1. NOUVELLE LOGIQUE : Calcul réaliste de la valeur sur le marché de l'occasion
export const calculerValeurResiduelleReelle = (prixAchat, dureeDetentionMois, kmAnnuel, motorisation, risqueDepreciationPct) => {
  const annees = dureeDetentionMois / 12;

  // Dépréciation de base selon la motorisation
  let tauxBase;
  switch(motorisation) {
    case 'BEV': tauxBase = 0.18; break;  // Électrique
    case 'PHEV': tauxBase = 0.17; break; // Hybride rechargeable
    case 'ICE': tauxBase = 0.15; break;  // Thermique
    default: tauxBase = 0.15;
  }

  // Ajustement kilométrique
  const kmStandard = 15000;
  const ecartKm = (kmAnnuel - kmStandard) / 5000;
  const ajustementKm = ecartKm * 0.01; 
  
  const tauxFinal = Math.min(0.35, Math.max(0.05, tauxBase + ajustementKm));
  const valeurStandard = prixAchat * Math.pow((1 - tauxFinal), annees);
  
  // Application du risque réglementaire/marché (ex: zones à faibles émissions)
  const facteurRisque = 1 - (risqueDepreciationPct / 100);
  const valeurFinale = valeurStandard * facteurRisque;

  return Math.max(0, Math.round(valeurFinale));
};

// 2. MOTEUR PRINCIPAL : Calcul des TCO et ventilation pour les graphiques
export const calculateResults = (cars, settings) => {
  return cars.map(car => {
    // --- A. FRAIS D'USAGE (Communs aux 3 modes) ---
    const kmMensuel = settings.kmAnnuel / 12;
    let coutEnergieMensuel = 0;

    if (car.motorisation === 'ICE') {
      coutEnergieMensuel = (kmMensuel / 100) * car.consoEssence * settings.prixEssence;
    } else if (car.motorisation === 'BEV') {
      coutEnergieMensuel = (kmMensuel / 100) * car.consoElec * settings.prixElec;
    } else if (car.motorisation === 'PHEV') {
      const partElec = settings.ratioElec / 100;
      const partEssence = 1 - partElec;
      const coutElec = (kmMensuel * partElec / 100) * car.consoElec * settings.prixElec;
      const coutEssence = (kmMensuel * partEssence / 100) * car.consoEssence * settings.prixEssence;
      coutEnergieMensuel = coutElec + coutEssence;
    }

    const fraisFixesMensuels = (car.assurance / 12) + 
                               (car.impotCantonal / 12) + 
                               (car.entretien / 12) + 
                               settings.parking + 
                               (settings.vignette / 12);
                               
    const fraisUsage = coutEnergieMensuel + fraisFixesMensuels;

    // --- B. VALEUR RÉSIDUELLE RÉELLE ---
    const valeurResiduelleReelle = calculerValeurResiduelleReelle(
      car.prixAchat, 
      settings.dureeDetention, 
      settings.kmAnnuel, 
      car.motorisation, 
      car.risqueDepreciation
    );

    // --- C. LEASING ---
    const montantFinanceLeasing = car.prixAchat - car.apport - car.valeurResiduelle;
    const interetsLeasingMensuels = ((car.prixAchat - car.apport + car.valeurResiduelle) / 2) * (car.tauxLeasing / 100 / 12);
    const mensualiteLeasing = (montantFinanceLeasing / settings.dureeMois) + interetsLeasingMensuels;
    
    const apportLisseLeasing = car.apport / settings.dureeMois;
    const opportuniteLeasing = (car.apport * (settings.tauxPlacement / 100)) / 12;
    const tcoLeasing = mensualiteLeasing + apportLisseLeasing + fraisUsage + opportuniteLeasing;

    // --- D. CRÉDIT ---
    const montantEmprunte = car.prixAchat - car.apportCredit;
    const tauxMensuelCredit = settings.tauxCreditGlobal / 100 / 12;
    
    const mensualiteCreditBrute = (tauxMensuelCredit === 0) 
        ? (montantEmprunte / settings.dureeMois)
        : montantEmprunte * (tauxMensuelCredit * Math.pow(1 + tauxMensuelCredit, settings.dureeMois)) / (Math.pow(1 + tauxMensuelCredit, settings.dureeMois) - 1);
    
    // Pour le crédit, le vrai coût n'est pas la mensualité (qui inclut du capital qui vous appartient), 
    // mais la PERTE de valeur de la voiture + les intérêts payés à la banque.
    const perteValeurCreditMensuelle = (car.prixAchat - valeurResiduelleReelle) / settings.dureeDetention;
    const interetsCreditMensuelsLisses = mensualiteCreditBrute - (montantEmprunte / settings.dureeMois);
    
    const opportuniteCredit = (car.apportCredit * (settings.tauxPlacement / 100)) / 12;
    const tcoCredit = perteValeurCreditMensuelle + interetsCreditMensuelsLisses + opportuniteCredit + fraisUsage;

    // --- E. COMPTANT ---
    const perteValeurComptantMensuelle = (car.prixAchat - valeurResiduelleReelle) / settings.dureeDetention;
    // L'argent bloqué dans la voiture ne rapporte plus rien : on l'applique sur la totalité du prix
    const opportuniteComptant = (car.prixAchat * (settings.tauxPlacement / 100)) / 12;
    const tcoComptant = perteValeurComptantMensuelle + opportuniteComptant + fraisUsage;

    // --- F. RETOUR DES DONNÉES STRUCTURÉES POUR L'UI ---
    return {
      name: car.name,
      coutEnergieMensuel,
      fraisUsage,
      valeurResiduelleReelle,
      leasing: {
        tco: Math.max(0, tcoLeasing),
        breakdown: {
          apportLisse: Math.max(0, apportLisseLeasing),
          banque: Math.max(0, mensualiteLeasing),
          energie: coutEnergieMensuel,
          fraisFixes: fraisFixesMensuels,
          opportunite: opportuniteLeasing,
          total: Math.max(0, tcoLeasing)
        }
      },
      credit: {
        tco: Math.max(0, tcoCredit),
        breakdown: {
          apportLisse: 0, 
          banque: Math.max(0, perteValeurCreditMensuelle + interetsCreditMensuelsLisses),
          energie: coutEnergieMensuel,
          fraisFixes: fraisFixesMensuels,
          opportunite: opportuniteCredit,
          total: Math.max(0, tcoCredit)
        }
      },
      comptant: {
        tco: Math.max(0, tcoComptant),
        breakdown: {
          apportLisse: 0,
          banque: Math.max(0, perteValeurComptantMensuelle),
          energie: coutEnergieMensuel,
          fraisFixes: fraisFixesMensuels,
          opportunite: opportuniteComptant,
          total: Math.max(0, tcoComptant)
        }
      }
    };
  });
};

// 3. FONCTION DE MISE À L'ÉCHELLE POUR LES GRAPHIQUES
export const calculateMaxTCO = (results) => {
  if (!results || results.length === 0) return 1000;
  let max = 0;
  results.forEach(r => {
    if (r.leasing.tco > max) max = r.leasing.tco;
    if (r.credit.tco > max) max = r.credit.tco;
    if (r.comptant.tco > max) max = r.comptant.tco;
  });
  return max * 1.05; // Marge de 5% pour que les barres ne touchent pas le bord
};