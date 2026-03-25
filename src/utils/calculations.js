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

// 2. FONCTION UTILITAIRE : Valeur actuelle d'une annuité de début de période
const valeurActuelleAnnuiteDebut = (montantMensuel, tauxMensuel, nbMois) => {
  if (tauxMensuel === 0) {
    return montantMensuel * nbMois;
  }
  const facteur = Math.pow(1 + tauxMensuel, -nbMois);
  return montantMensuel * (1 - facteur) / tauxMensuel * (1 + tauxMensuel);
};

// 3. MOTEUR PRINCIPAL : Calcul des TCO et ventilation pour les graphiques
export const calculateResults = (cars, settings) => {
  return cars.map(car => {
    // --- A. CALCUL DES TAUX D'ACTUALISATION ---
    // Taux d'inflation mensuel (pour actualiser les flux futurs)
    const tauxInflationMensuel = (settings.inflationAnnuelle / 100) / 12;
    
    // --- B. FRAIS D'USAGE (Communs aux 3 modes) ---
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

    // --- C. VALEUR RÉSIDUELLE RÉELLE ---
    const valeurResiduelleReelle = calculerValeurResiduelleReelle(
      car.prixAchat, 
      settings.dureeDetention, 
      settings.kmAnnuel, 
      car.motorisation, 
      car.risqueDepreciation
    );

    // --- D. LEASING (Dette fixe - impact de l'inflation) ---
    const montantFinanceLeasing = car.prixAchat - car.apport - car.valeurResiduelle;
    const interetsLeasingMensuels = ((car.prixAchat - car.apport + car.valeurResiduelle) / 2) * (car.tauxLeasing / 100 / 12);
    const mensualiteLeasingBrute = (montantFinanceLeasing / settings.dureeMois) + interetsLeasingMensuels;
    
    // Actualisation de la mensualité de leasing avec l'inflation
    // L'inflation réduit la valeur réelle des paiements futurs (dette fixe)
    const valeurActuelleLeasing = valeurActuelleAnnuiteDebut(mensualiteLeasingBrute, tauxInflationMensuel, settings.dureeMois);
    const mensualiteLeasingActualisee = valeurActuelleLeasing / settings.dureeMois;
    
    const apportLisseLeasing = car.apport / settings.dureeMois;
    const opportuniteLeasing = (car.apport * (settings.tauxPlacement / 100)) / 12;
    const tcoLeasing = mensualiteLeasingActualisee + apportLisseLeasing + fraisUsage + opportuniteLeasing;

    // --- E. CRÉDIT (Dette fixe - approche par taux d'intérêt réel) ---
    const montantEmprunte = car.prixAchat - car.apportCredit;
    const tauxMensuelCredit = settings.tauxCreditGlobal / 100 / 12;
    
    // Taux d'intérêt réel (nominal - inflation) pour refléter le coût réel de la dette
    const tauxInteretReelMensuel = Math.max(0, tauxMensuelCredit - tauxInflationMensuel);
    
    // Calcul de la mensualité basée sur le taux d'intérêt réel
    const mensualiteCreditReelle = (tauxInteretReelMensuel === 0) 
        ? (montantEmprunte / settings.dureeMois)
        : montantEmprunte * (tauxInteretReelMensuel * Math.pow(1 + tauxInteretReelMensuel, settings.dureeMois)) / (Math.pow(1 + tauxInteretReelMensuel, settings.dureeMois) - 1);
    
    // Pour le crédit, le vrai coût n'est pas la mensualité (qui inclut du capital qui vous appartient), 
    // mais la PERTE de valeur de la voiture + les intérêts réels payés à la banque.
    const perteValeurCreditMensuelle = (car.prixAchat - valeurResiduelleReelle) / settings.dureeDetention;
    const interetsCreditMensuelsReels = mensualiteCreditReelle - (montantEmprunte / settings.dureeMois);
    
    const opportuniteCredit = (car.apportCredit * (settings.tauxPlacement / 100)) / 12;
    const tcoCredit = perteValeurCreditMensuelle + interetsCreditMensuelsReels + opportuniteCredit + fraisUsage;

    // --- F. COMPTANT (Décaissement immédiat - pas d'impact inflation) ---
    const perteValeurComptantMensuelle = (car.prixAchat - valeurResiduelleReelle) / settings.dureeDetention;
    // L'argent bloqué dans la voiture ne rapporte plus rien : on l'applique sur la totalité du prix
    const opportuniteComptant = (car.prixAchat * (settings.tauxPlacement / 100)) / 12;
    const tcoComptant = perteValeurComptantMensuelle + opportuniteComptant + fraisUsage;

    // --- G. RETOUR DES DONNÉES STRUCTURÉES POUR L'UI ---
    return {
      name: car.name,
      coutEnergieMensuel,
      fraisUsage,
      valeurResiduelleReelle,
      leasing: {
        tco: Math.max(0, tcoLeasing),
        breakdown: {
          apportLisse: Math.max(0, apportLisseLeasing),
          banque: Math.max(0, mensualiteLeasingActualisee),
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
          banque: Math.max(0, perteValeurCreditMensuelle + interetsCreditMensuelsReels),
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