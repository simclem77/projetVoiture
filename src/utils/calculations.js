// utils/calculations.js

// Fonction utilitaire pour éviter les erreurs NaN lors de la saisie
export const parseDecimal = (value) => {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(String(value).replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
};

// 1. NOUVELLE LOGIQUE : Calcul réaliste de la valeur sur le marché de l'occasion
// avec prise en compte de l'état du véhicule (neuf/occasion) et de l'âge
export const calculerValeurResiduelleReelle = (prixAchat, dureeDetentionMois, kmAnnuel, motorisation, risqueDepreciationPct, etat = 'neuf', ageMois = 0) => {
  const annees = dureeDetentionMois / 12;

  // Dépréciation de base selon la motorisation ET l'état
  let tauxBase;
  if (etat === 'occasion') {
    // Un véhicule d'occasion décote moins vite sur la période suivante
    switch(motorisation) {
      case 'BEV': tauxBase = 0.12; break;  // Électrique
      case 'PHEV': tauxBase = 0.10; break; // Hybride rechargeable
      case 'ICE': tauxBase = 0.08; break;  // Thermique
      default: tauxBase = 0.08;
    }
  } else {
    // Logique actuelle pour le neuf
    switch(motorisation) {
      case 'BEV': tauxBase = 0.18; break;  // Électrique
      case 'PHEV': tauxBase = 0.17; break; // Hybride rechargeable
      case 'ICE': tauxBase = 0.15; break;  // Thermique
      default: tauxBase = 0.15;
    }
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
  
  // Fonction financière universelle (Équivalent de VPM/PMT dans Excel)
  const PMT = (rate, nper, pv, fv = 0, type = 0) => {
    if (rate === 0) return -(pv + fv) / nper;
    const pvif = Math.pow(1 + rate, nper);
    let pmt = rate / (pvif - 1) * -(pv * pvif + fv);
    // type === 1 signifie paiement en début de mois
    if (type === 1) pmt /= (1 + rate);
    return pmt;
  };

  return cars.map(car => {
    const Inf = settings.inflationAnnuelle / 100;
    const T_Plac = settings.tauxPlacement / 100;
    const N = settings.dureeMois;
    const N_detention = settings.dureeDetention;

    // --- A. FRAIS D'USAGE (Communs aux 3 modes) ---
    const kmMensuel = settings.kmAnnuel / 12;
    let coutEnergieMensuel = 0;

    if (car.motorisation === 'ICE') {
      coutEnergieMensuel = (kmMensuel / 100) * car.consoEssence * settings.prixEssence;
    } else if (car.motorisation === 'BEV') {
      coutEnergieMensuel = (kmMensuel / 100) * car.consoElec * settings.prixElec;
    } else if (car.motorisation === 'PHEV') {
      const partElec = settings.ratioElec / 100;
      const coutElec = (kmMensuel * partElec / 100) * car.consoElec * settings.prixElec;
      const coutEssence = (kmMensuel * (1 - partElec) / 100) * car.consoEssence * settings.prixEssence;
      coutEnergieMensuel = coutElec + coutEssence;
    }

    const fraisFixesMensuels = (car.assurance / 12) + (car.impotCantonal / 12) + (car.entretien / 12) + settings.parking + (settings.vignette / 12);
    const fraisUsage = coutEnergieMensuel + fraisFixesMensuels;

    // --- B. VALEUR RÉSIDUELLE RÉELLE ---
    const valeurResiduelleReelle = calculerValeurResiduelleReelle(
      car.prixAchat, settings.dureeDetention, settings.kmAnnuel, car.motorisation, car.risqueDepreciation, car.etat, car.ageMois
    );

    // --- C. LEASING ---
    const T_L_nom = car.tauxLeasing / 100;
    const T_L_real_m = (T_L_nom - Inf) / 12; // Autorise les taux négatifs
    const PV_L = car.prixAchat - car.apport;
    
    // Utilisation de la vraie fonction PMT en début de période (1)
    const mensualiteLeasingActualisee = -PMT(T_L_real_m, N, PV_L, -car.valeurResiduelle, 1);
    // Calcul de la mensualité brute (sans inflation) pour la trésorerie
    const T_L_nom_m = T_L_nom / 12;
    const mensualiteLeasingBrute = -PMT(T_L_nom_m, N, PV_L, -car.valeurResiduelle, 1);
    
    const apportLisseLeasing = car.apport / N;
    const opportuniteLeasing = (car.apport * T_Plac) / 12;
    const tcoLeasing = mensualiteLeasingActualisee + apportLisseLeasing + opportuniteLeasing + fraisUsage;
    // Trésorerie mensuelle : mensualité brute + frais d'usage (sans apport lissé ni opportunité)
    const tresorerieLeasing = mensualiteLeasingBrute + fraisUsage;

    // --- D. CRÉDIT ---
    const T_C_nom = settings.tauxCreditGlobal / 100;
    const T_C_real_m = (T_C_nom - Inf) / 12; // Autorise les taux négatifs
    const PV_C = car.prixAchat - car.apportCredit;

    const mensualiteCreditReelle = -PMT(T_C_real_m, N, PV_C, 0, 1);
    // Calcul de la mensualité brute (sans inflation) pour la trésorerie
    const T_C_nom_m = T_C_nom / 12;
    const mensualiteCreditBrute = -PMT(T_C_nom_m, N, PV_C, 0, 1);
    
    // Pour le crédit, la banque gagne l'amortissement + les intérêts réels
      const interetsCreditMensuelsReels = mensualiteCreditReelle - (PV_C / N);
    const interetsCreditMensuelsBruts = mensualiteCreditBrute - (PV_C / N);
    const perteValeurCreditMensuelle = (car.prixAchat - valeurResiduelleReelle) / N_detention;
    const opportuniteCredit = (car.apportCredit * T_Plac) / 12;
    
    const tcoCredit = perteValeurCreditMensuelle + interetsCreditMensuelsReels + opportuniteCredit + fraisUsage;
    // Trésorerie mensuelle : mensualité brute + frais d'usage
    const tresorerieCredit = mensualiteCreditBrute + fraisUsage;

    // --- E. COMPTANT ---
    const perteValeurComptantMensuelle = (car.prixAchat - valeurResiduelleReelle) / N_detention;
    const opportuniteComptant = (car.prixAchat * T_Plac) / 12;
    const tcoComptant = perteValeurComptantMensuelle + opportuniteComptant + fraisUsage;
    // Trésorerie mensuelle : uniquement les frais d'usage (la voiture est payée cash au départ)
    const tresorerieComptant = fraisUsage;

    // --- F. RETOUR ---
    return {
      name: car.name,
      coutEnergieMensuel,
      fraisUsage,
      valeurResiduelleReelle,
      leasing: {
        tco: Math.max(0, tcoLeasing),
        tresorerieMensuelle: Math.max(0, tresorerieLeasing),
        mensualiteBrute: Math.max(0, mensualiteLeasingBrute),
        breakdown: {
          apportLisse: Math.max(0, apportLisseLeasing),
          loyer: Math.max(0, mensualiteLeasingBrute),
          energie: coutEnergieMensuel,
          fraisFixes: fraisFixesMensuels,
          opportunite: Math.max(0, opportuniteLeasing),
          total: Math.max(0, tcoLeasing)
        }
      },
      credit: {
        tco: Math.max(0, tcoCredit),
        tresorerieMensuelle: Math.max(0, tresorerieCredit),
        mensualiteBrute: Math.max(0, mensualiteCreditBrute),
        breakdown: {
          apportLisse: 0, 
          depreciation: Math.max(0, perteValeurCreditMensuelle),
          interets: Math.max(0, interetsCreditMensuelsBruts),
          energie: coutEnergieMensuel,
          fraisFixes: fraisFixesMensuels,
          opportunite: Math.max(0, opportuniteCredit),
          total: Math.max(0, tcoCredit)
        }
      },
      comptant: {
        tco: Math.max(0, tcoComptant),
        tresorerieMensuelle: Math.max(0, tresorerieComptant),
        breakdown: {
          apportLisse: 0,
          depreciation: Math.max(0, perteValeurComptantMensuelle),
          energie: coutEnergieMensuel,
          fraisFixes: fraisFixesMensuels,
          opportunite: Math.max(0, opportuniteComptant),
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