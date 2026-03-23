import React, { useState, useEffect } from 'react';
import { Calculator, Car, Save, Cloud, CheckCircle, Wallet, Plus, Trash2, BarChart3, AlertCircle, Key, Users, Copy, X, Maximize2, Download, Database, Wifi, WifiOff, Info, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { fetchData, saveData, checkHealth, processSyncQueue, isOnline, getQueueSize } from './api';

// --- Configuration pour Raspberry Pi (Mode local uniquement) ---
const isFirebaseValid = false; // Désactivé pour Raspberry Pi
const app = null;
const auth = null;
const db = null;
const currentAppId = 'comparateur-auto-local';

// Composant pour la saisie numérique avec gestion optimisée pour mobile
// Ce composant gère un état local en texte pour permettre de taper "." ou ","
// sans que le curseur ne saute ou que le caractère disparaisse.
const NumericInput = ({ value, onChange, className, placeholder, inputMode = "decimal" }) => {
  const [localValue, setLocalValue] = useState(value?.toString() || "");

  // Synchronisation si la valeur change de l'extérieur
  useEffect(() => {
    const stringValue = value?.toString() || "";
    if (parseFloat(localValue) !== value && localValue !== stringValue) {
      setLocalValue(stringValue);
    }
  }, [value]);

  const handleChange = (e) => {
    const rawValue = e.target.value;
    const normalizedValue = rawValue.replace(',', '.');

    // On met à jour l'affichage immédiatement (autorise "7." temporairement)
    setLocalValue(rawValue);

    // On propage le nombre au parent uniquement si c'est valide
    const parsed = parseFloat(normalizedValue);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else if (rawValue === "") {
      onChange(0);
    }
  };

  return (
    <input
      type="text"
      inputMode={inputMode}
      value={localValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
    />
  );
};

// Fonction utilitaire pour convertir les nombres avec séparateurs décimaux (format suisse)
const parseDecimal = (value) => {
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

// Fonction pour formater l'affichage avec le séparateur approprié (point pour la Suisse)
const formatDecimal = (value, decimals = 2) => {
  const num = typeof value === 'number' ? value : parseDecimal(value);
  return num.toFixed(decimals); // Utilise le point comme séparateur décimal
};

// Composant Tooltip optimisé pour les barres empilées
const Tooltip = ({ children, content, position = 'top', width = '100%' }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div 
      className="relative flex"
      style={{ width }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && (
        <div className={`
          absolute z-50 px-3 py-2 text-xs font-medium text-white bg-slate-800 rounded-lg shadow-lg
          whitespace-nowrap pointer-events-none
          ${position === 'top' ? 'bottom-full mb-2 left-1/2 transform -translate-x-1/2' : ''}
          ${position === 'bottom' ? 'top-full mt-2 left-1/2 transform -translate-x-1/2' : ''}
        `}>
          {content}
          {/* Flèche du tooltip */}
          <div className={`
            absolute w-2 h-2 bg-slate-800 transform rotate-45
            ${position === 'top' ? 'top-full -mt-1 left-1/2 -translate-x-1/2' : ''}
            ${position === 'bottom' ? 'bottom-full -mb-1 left-1/2 -translate-x-1/2' : ''}
          `}></div>
        </div>
      )}
    </div>
  );
};

// Composant StackedBarChart pour les graphiques TCO empilés
const StackedBarChart = ({ breakdown, type, vehicleName, motorisation }) => {
  const categories = [
    { key: 'financement', label: 'Financement', tooltip: 'Loyer leasing, mensualité crédit ou dépréciation mensuelle cash' },
    { key: 'energie', label: 'Énergie', tooltip: motorisation === 'ICE' ? 'Essence uniquement' : motorisation === 'BEV' ? 'Électricité uniquement' : 'Mix PHEV (électricité + essence)' },
    { key: 'fraisFixes', label: 'Frais Fixes', tooltip: 'Assurance + Impôt + Parking + Vignette' },
    { key: 'entretien', label: 'Entretien', tooltip: 'Frais de maintenance mensuels' },
    { key: 'opportunite', label: 'Opportunité', tooltip: 'Manque à gagner sur le placement de l\'apport ou du capital' }
  ];

  // Couleurs selon le type de financement
  const colorSchemes = {
    leasing: {
      financement: 'bg-blue-800',
      energie: 'bg-blue-600',
      fraisFixes: 'bg-blue-400',
      entretien: 'bg-blue-300',
      opportunite: 'bg-indigo-500'
    },
    credit: {
      financement: 'bg-emerald-800',
      energie: 'bg-emerald-600',
      fraisFixes: 'bg-emerald-400',
      entretien: 'bg-emerald-300',
      opportunite: 'bg-teal-500'
    },
    comptant: {
      financement: 'bg-purple-800',
      energie: 'bg-purple-600',
      fraisFixes: 'bg-purple-400',
      entretien: 'bg-purple-300',
      opportunite: 'bg-purple-500'
    }
  };

  const colors = colorSchemes[type] || colorSchemes.leasing;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs">
        <span className="font-medium text-slate-700">
          {type === 'leasing' ? 'Leasing' : type === 'credit' ? 'Crédit' : 'Comptant'}
        </span>
        <span className="font-bold text-slate-800">{breakdown.total.toFixed(0)} CHF</span>
      </div>
      
      <div className="w-full h-6 bg-slate-100 rounded-full overflow-hidden flex relative">
        {categories.map(category => {
          const value = breakdown[category.key];
          const percentage = (value / breakdown.total) * 100;
          
          if (value <= 0) return null;
          
          return (
            <Tooltip
              key={category.key}
              content={`${category.label}: ${value.toFixed(0)} CHF`}
              position="top"
              width={`${percentage}%`}
            >
              <div
                className={`h-full ${colors[category.key]} transition-all duration-300 hover:opacity-90`}
                style={{ width: `${percentage}%` }}
              >
                <div className="relative w-full h-full">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {value.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            </Tooltip>
          );
        })}
      </div>
      
      {/* Légende des segments */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {categories.map(category => {
          const value = breakdown[category.key];
          if (value <= 0) return null;
          
          return (
            <Tooltip
              key={category.key}
              content={`${category.label}: ${value.toFixed(0)} CHF - ${category.tooltip}`}
              position="top"
            >
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-200 cursor-help">
                <div className={`w-2 h-2 ${colors[category.key]} rounded`}></div>
                <span className="text-slate-700 font-medium">{category.label}</span>
                <span className="text-slate-500">{value.toFixed(0)}</span>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

const App = () => {
  // --- ÉTAT AUTH & SAUVEGARDE ---
  const [user, setUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [apiHealth, setApiHealth] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  
  // --- SYSTÈME DE CODE PARTAGÉ ---
  const [sharedCode, setSharedCode] = useState(() => {
    // Récupérer le code depuis le localStorage s'il existe
    return localStorage.getItem('comparateur_shared_code') || 'COMP123';
  });
  const [isCodeValid, setIsCodeValid] = useState(true);
  const [showLoadButton, setShowLoadButton] = useState(false);
  
  // --- ÉTAT MODAL IMAGE ---
  const [modalImage, setModalImage] = useState({
    isOpen: false,
    url: '',
    title: ''
  });

  // --- ÉTAT GUIDE PÉDAGOGIQUE ---
  const [isGuideOpen, setIsGuideOpen] = useState(true);

  // --- PARAMÈTRES GLOBAUX ---
  const [dureeMois, setDureeMois] = useState(48);
  const [kmAnnuel, setKmAnnuel] = useState(15000);
  const [parking, setParking] = useState(0); 
  const [vignette, setVignette] = useState(40); 
  const [tauxCreditGlobal, setTauxCreditGlobal] = useState(4.9);
  const [inflationAnnuelle, setInflationAnnuelle] = useState(2.0);
  const [tauxPlacement, setTauxPlacement] = useState(3.0);
  const [prixEssence, setPrixEssence] = useState(1.85);
  const [prixElec, setPrixElec] = useState(0.33);
  const [ratioElec, setRatioElec] = useState(80);

  // --- VÉHICULES (Tableau d'objets dynamique) ---
  const [cars, setCars] = useState(() => {
    // Charger les données par défaut immédiatement pour éviter le flash
    return [
      {
        id: 1,
        name: "Votre Devis Actuel",
        photoUrl: "",
        commentaire: "",
        motorisation: 'PHEV', // ICE, PHEV, BEV
        prixAchat: 52037,
        apport: 15000,
        apportCredit: 15000, // Apport spécifique pour le crédit
        tauxLeasing: 0.99,
        valeurResiduelle: 23784,
        assurance: 1500,
        impotCantonal: 450,
        consoElec: 0, // kWh/100km
        consoEssence: 7.5, // L/100km
        risqueDepreciation: 10, // % de risque de dépréciation
        entretien: 0 
      },
      {
        id: 2,
        name: "Break Hybride (Exemple)",
        photoUrl: "",
        commentaire: "",
        motorisation: 'PHEV', // ICE, PHEV, BEV
        prixAchat: 46000,
        apport: 10000,
        apportCredit: 10000,
        tauxLeasing: 2.9,
        valeurResiduelle: 18000,
        assurance: 1300,
        impotCantonal: 250,
        consoElec: 15, // kWh/100km
        consoEssence: 5.5, // L/100km
        risqueDepreciation: 15, // % de risque de dépréciation
        entretien: 700
      },
      {
        id: 3,
        name: "Électrique Familiale",
        photoUrl: "",
        commentaire: "",
        motorisation: 'BEV', // ICE, PHEV, BEV
        prixAchat: 56000,
        apport: 15000,
        apportCredit: 15000,
        tauxLeasing: 1.5,
        valeurResiduelle: 26000,
        assurance: 1600,
        impotCantonal: 0, 
        consoElec: 18, // kWh/100km
        consoEssence: 0, // L/100km
        risqueDepreciation: 20, // % de risque de dépréciation
        entretien: 300 
      }
    ];
  });
  
  // Données par défaut si Firebase n'est pas configuré ou si aucune donnée n'existe
  const defaultCars = [
    {
      id: 1,
      name: "Votre Devis Actuel",
      photoUrl: "",
      commentaire: "",
      prixAchat: 52037,
      apport: 15000,
      apportCredit: 15000,
      tauxLeasing: 0.99,
      valeurResiduelle: 23784,
      assurance: 1500,
      impotCantonal: 450,
      consommation: 7.5, 
      prixCarburant: 1.85,
      entretien: 0 
    },
    {
      id: 2,
      name: "Break Hybride (Exemple)",
      photoUrl: "",
      commentaire: "",
      prixAchat: 46000,
      apport: 10000,
      apportCredit: 10000,
      tauxLeasing: 2.9,
      valeurResiduelle: 18000,
      assurance: 1300,
      impotCantonal: 250,
      consommation: 5.5,
      prixCarburant: 1.85,
      entretien: 700
    },
    {
      id: 3,
      name: "Électrique Familiale",
      photoUrl: "",
      commentaire: "",
      prixAchat: 56000,
      apport: 15000,
      apportCredit: 15000,
      tauxLeasing: 1.5,
      valeurResiduelle: 26000,
      assurance: 1600,
      impotCantonal: 0, 
      consommation: 18, 
      prixCarburant: 0.28, 
      entretien: 300 
    }
  ];

  // Actions sur les véhicules
  const updateCar = (index, field, value) => {
    const newCars = [...cars];
    // Utiliser parseDecimal pour les champs numériques
    const numericFields = ['prixAchat', 'apport', 'apportCredit', 'tauxLeasing', 'valeurResiduelle', 
                          'assurance', 'impotCantonal', 'consoElec', 'consoEssence', 'risqueDepreciation', 'entretien'];
    
    if (numericFields.includes(field)) {
      newCars[index][field] = parseDecimal(value);
    } else {
      newCars[index][field] = value;
    }

    // Ajustement automatique des valeurs selon le type de motorisation
    if (field === 'motorisation') {
      const car = newCars[index];
      switch (value) {
        case 'ICE': // Thermique
          // Impôt cantonal plus élevé (barème Vaudois)
          if (car.impotCantonal < 400) car.impotCantonal = 450;
          // Risque de dépréciation plus fort pour Lausanne 2030
          if (car.risqueDepreciation < 15) car.risqueDepreciation = 20;
          // Consommation électrique à 0
          car.consoElec = 0;
          break;
        case 'BEV': // Électrique
          // Exonération d'impôt cantonal (si toujours en vigueur)
          car.impotCantonal = 0;
          // Risque de dépréciation faible
          if (car.risqueDepreciation > 10) car.risqueDepreciation = 5;
          // Consommation essence à 0
          car.consoEssence = 0;
          break;
        case 'PHEV': // Hybride Rechargeable
          // Valeurs intermédiaires
          if (car.impotCantonal === 0) car.impotCantonal = 250;
          if (car.risqueDepreciation < 10) car.risqueDepreciation = 15;
          break;
      }
    }

    setCars(newCars);
  };

  const addCar = () => {
    const newId = cars.length > 0 ? Math.max(...cars.map(c => c.id)) + 1 : 1;
    setCars([...cars, {
      id: newId,
      name: `Nouveau Véhicule`,
      photoUrl: "",
      commentaire: "",
      prixAchat: 40000,
      apport: 10000,
      tauxLeasing: 2.9,
      valeurResiduelle: 15000,
      assurance: 1200,
      impotCantonal: 300,
      consommation: 6.0,
      prixCarburant: 1.85,
      entretien: 500
    }]);
  };

  const removeCar = (idToRemove) => {
    if (cars.length > 1) {
      setCars(cars.filter(car => car.id !== idToRemove));
    }
  };

  // --- EFFET DE CHARGEMENT INITIAL (API + localStorage) ---
  useEffect(() => {
    const loadInitialData = async () => {
      console.log(`🔄 Chargement des données pour le code: ${sharedCode}`);
      
      try {
        // 1. Essayer de charger depuis l'API SQLite
        const data = await fetchData(sharedCode);
        if (data && data.cars) {
          setCars(data.cars);
          if (data.dureeMois) setDureeMois(data.dureeMois);
          if (data.kmAnnuel) setKmAnnuel(data.kmAnnuel);
          if (data.parking !== undefined) setParking(data.parking);
          if (data.vignette !== undefined) setVignette(data.vignette);
          if (data.tauxCreditGlobal !== undefined) setTauxCreditGlobal(data.tauxCreditGlobal);
          if (data.inflationAnnuelle !== undefined) setInflationAnnuelle(data.inflationAnnuelle);
          if (data.tauxPlacement !== undefined) setTauxPlacement(data.tauxPlacement);
          if (data.updatedAt) setLastSaved(new Date(data.updatedAt));
          setIsCodeValid(true);
          console.log('✅ Données chargées depuis l\'API SQLite');
          return; // Données trouvées dans l'API, on s'arrête là
        }
      } catch (error) {
        console.warn('⚠️ API non disponible, fallback localStorage:', error.message);
      }
      
      // 2. Fallback : charger depuis localStorage
      const savedData = localStorage.getItem(`comparateur_${sharedCode}`);
      if (savedData) {
        try {
          const data = JSON.parse(savedData);
          if (data.cars) setCars(data.cars);
          if (data.dureeMois) setDureeMois(data.dureeMois);
          if (data.kmAnnuel) setKmAnnuel(data.kmAnnuel);
          if (data.parking !== undefined) setParking(data.parking);
          if (data.vignette !== undefined) setVignette(data.vignette);
          if (data.tauxCreditGlobal !== undefined) setTauxCreditGlobal(data.tauxCreditGlobal);
          if (data.inflationAnnuelle !== undefined) setInflationAnnuelle(data.inflationAnnuelle);
          if (data.tauxPlacement !== undefined) setTauxPlacement(data.tauxPlacement);
          if (data.updatedAt) setLastSaved(new Date(data.updatedAt));
          setIsCodeValid(true);
          console.log('📦 Données chargées depuis localStorage');
        } catch (error) {
          console.warn("❌ Erreur de chargement localStorage:", error);
        }
      } else {
        console.log('ℹ️ Aucune donnée trouvée, utilisation des valeurs par défaut');
      }
    };
    
    loadInitialData();
  }, [sharedCode]);

  // Sauvegarde automatique quand les données changent
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      const data = {
        cars,
        dureeMois,
        kmAnnuel,
        parking,
        vignette,
        tauxCreditGlobal,
        inflationAnnuelle,
        tauxPlacement,
        sharedCode,
        updatedAt: new Date().toISOString()
      };
      
      // Sauvegarde dans l'API SQLite
      saveData(sharedCode, data).then(result => {
        if (result.success) {
          setLastSaved(new Date());
          setIsCodeValid(true);
          if (result.queued) {
            setQueueSize(getQueueSize());
          }
        }
      }).catch(error => {
        console.warn('Erreur sauvegarde auto:', error);
      });
      
    }, 2000); // Délai de 2s pour éviter trop de requêtes

    return () => clearTimeout(saveTimeout);
  }, [cars, dureeMois, kmAnnuel, parking, vignette, tauxCreditGlobal, inflationAnnuelle, tauxPlacement, sharedCode]);

  // Vérifier la santé de l'API au démarrage
  useEffect(() => {
    checkHealth().then(healthy => {
      setApiHealth(healthy);
      if (healthy) {
        processSyncQueue().then(result => {
          if (result.processed > 0) {
            setQueueSize(result.remaining);
          }
        });
      }
    });
    
    // Vérifier périodiquement
    const healthInterval = setInterval(() => {
      checkHealth().then(setApiHealth);
    }, 30000); // Toutes les 30 secondes
    
    return () => clearInterval(healthInterval);
  }, []);

  // Mettre à jour la taille de la queue
  useEffect(() => {
    setQueueSize(getQueueSize());
  }, [cars, sharedCode]);

  const saveDataToServer = async () => {
    setIsSaving(true);
    
    const data = {
      cars,
      dureeMois,
      kmAnnuel,
      parking,
      vignette,
      tauxCreditGlobal,
      inflationAnnuelle,
      tauxPlacement,
      sharedCode,
      updatedAt: new Date().toISOString()
    };
    
    try {
      const result = await saveData(sharedCode, data);
      
      if (result.success) {
        setLastSaved(new Date());
        setIsCodeValid(true);
        
        if (result.queued) {
          setQueueSize(getQueueSize());
          alert('📱 Données mises en queue pour synchronisation (mode hors ligne)');
        } else {
          alert('✅ Données sauvegardées sur le serveur SQLite !');
        }
      } else {
        setSaveError(true);
        alert('❌ Erreur de sauvegarde. Vérifiez la connexion au serveur.');
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      setSaveError(true);
      alert('❌ Erreur de sauvegarde: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- MOTEUR DE CALCUL ---
  const calculateResults = () => {
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

      // B. Coût d'Opportunité (Manque à gagner sur placement)
      const opportuniteApportLeasingMensuel = (car.apport * tauxPlacement / 100) / 12;
      const opportuniteApportCreditMensuel = (car.apportCredit * tauxPlacement / 100) / 12;
      const opportuniteComptantMensuel = (car.prixAchat * tauxPlacement / 100) / 12;

      // Frais Fixes
      const coutFixeMensuel = (car.assurance + car.impotCantonal + vignette) / 12 + parking;
      const coutVariableMensuel = coutEnergieMensuel + (car.entretien / 12);
      const fraisUsage = coutFixeMensuel + coutVariableMensuel;

      // Valeur résiduelle réelle avec risque de dépréciation
      const valeurResiduelleReelle = car.valeurResiduelle * (1 - car.risqueDepreciation / 100);

      // 1. LEASING
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
      const coutVehiculeLisseLeasing = (car.apport + (pmtLeasing * dureeMois)) / dureeMois;
      const tcoLeasing = coutVehiculeLisseLeasing + fraisUsage + opportuniteApportLeasingMensuel;

      // 2. CRÉDIT (avec apportCredit spécifique, risque de dépréciation et coût d'opportunité)
      const capitalFinanceCredit = car.prixAchat - car.apportCredit;
      const rCredit = (tauxCreditGlobal / 100) / 12;
      let pmtCredit = 0;
      if (rCredit > 0) {
        pmtCredit = capitalFinanceCredit * (rCredit / (1 - Math.pow(1 + rCredit, -dureeMois)));
      } else {
        pmtCredit = capitalFinanceCredit / dureeMois;
      }
      // Amortissement net avec risque de dépréciation (comme pour le comptant)
      const coutVehiculeLisseCredit = (car.apportCredit + (pmtCredit * dureeMois) - valeurResiduelleReelle) / dureeMois;
      const tcoCredit = coutVehiculeLisseCredit + fraisUsage + opportuniteApportCreditMensuel;

      // 3. COMPTANT avec risque de dépréciation
      const coutVehiculeLisseComptant = (car.prixAchat - valeurResiduelleReelle) / dureeMois;
      const tcoComptant = coutVehiculeLisseComptant + fraisUsage + opportuniteComptantMensuel;

      // Breakdown détaillé pour les graphiques empilés
      const breakdownLeasing = {
        financement: coutVehiculeLisseLeasing,
        energie: coutEnergieMensuel,
        fraisFixes: coutFixeMensuel,
        entretien: car.entretien / 12,
        opportunite: opportuniteApportLeasingMensuel,
        total: tcoLeasing
      };

      const breakdownCredit = {
        financement: coutVehiculeLisseCredit,
        energie: coutEnergieMensuel,
        fraisFixes: coutFixeMensuel,
        entretien: car.entretien / 12,
        opportunite: opportuniteApportCreditMensuel,
        total: tcoCredit
      };

      const breakdownComptant = {
        financement: coutVehiculeLisseComptant,
        energie: coutEnergieMensuel,
        fraisFixes: coutFixeMensuel,
        entretien: car.entretien / 12,
        opportunite: opportuniteComptantMensuel,
        total: tcoComptant
      };

      return {
        ...car,
        fraisUsage,
        coutEnergieMensuel,
        opportuniteApportLeasingMensuel,
        opportuniteApportCreditMensuel,
        opportuniteComptantMensuel,
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

  const results = calculateResults();

  // Trouver le max pour le graphique
  const maxTCO = Math.max(...results.map(r => Math.max(r.leasing.tco, r.credit.tco, r.comptant.tco)), 1);

  // Fonction pour mettre à jour le code partagé
  const updateSharedCode = (newCode) => {
    const cleanCode = newCode.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
    setSharedCode(cleanCode);
    localStorage.setItem('comparateur_shared_code', cleanCode);
    setIsCodeValid(true);
    setShowLoadButton(true); // Montrer le bouton de chargement
  };

  // Fonction pour charger les données avec le code actuel
  const loadDataForCurrentCode = async () => {
    // Feedback visuel immédiat
    setIsSaving(true);
    
    try {
      const data = await fetchData(sharedCode);
      
      if (data) {
        if (data.cars) setCars(data.cars);
        if (data.dureeMois) setDureeMois(data.dureeMois);
        if (data.kmAnnuel) setKmAnnuel(data.kmAnnuel);
        if (data.parking !== undefined) setParking(data.parking);
        if (data.vignette !== undefined) setVignette(data.vignette);
        if (data.tauxCreditGlobal !== undefined) setTauxCreditGlobal(data.tauxCreditGlobal);
        if (data.inflationAnnuelle !== undefined) setInflationAnnuelle(data.inflationAnnuelle);
        if (data.tauxPlacement !== undefined) setTauxPlacement(data.tauxPlacement);
        if (data.updatedAt) setLastSaved(new Date(data.updatedAt));
        setIsCodeValid(true);
        setShowLoadButton(false); // Cacher le bouton après chargement
        
        alert(`✅ Données chargées depuis le serveur SQLite pour le code "${sharedCode}"`);
      } else {
        // Aucune donnée trouvée pour ce code
        alert(`Aucune donnée trouvée pour le code "${sharedCode}".\n\nCréez d'abord des données avec ce code sur un autre appareil, ou utilisez un code existant.`);
      }
    } catch (error) {
      console.warn("Erreur de chargement API:", error);
      alert(`❌ Erreur de chargement: ${error.message}\n\nVérifiez la connexion au serveur SQLite.`);
    } finally {
      setIsSaving(false);
      setShowLoadButton(false);
    }
  };

  // Fonction pour copier le code dans le presse-papier
  const copyToClipboard = () => {
    navigator.clipboard.writeText(sharedCode);
  };

  // Fonction pour ouvrir l'image en grand
  const openImageModal = (url, title) => {
    if (url && url.trim() !== '') {
      setModalImage({
        isOpen: true,
        url,
        title
      });
    }
  };

  // Fonction pour fermer la modal
  const closeImageModal = () => {
    setModalImage({
      isOpen: false,
      url: '',
      title: ''
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <header className="mb-6 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Car className="w-8 h-8 text-indigo-600" />
              Comparateur Multi-Véhicules
            </h1>
            <p className="text-slate-500 mt-2">Comparez les offres et trouvez le véhicule le plus adapté à votre budget.</p>
            
            {/* Section Code Partagé */}
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium text-slate-700">Code de partage :</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    value={sharedCode}
                    onChange={(e) => updateSharedCode(e.target.value)}
                    className={`px-3 py-1.5 border ${isCodeValid ? 'border-slate-300' : 'border-red-300'} rounded-lg font-mono font-bold text-indigo-700 bg-white text-center w-32`}
                    maxLength={8}
                    placeholder="COMP123"
                  />
                  {!isCodeValid && (
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">!</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors"
                  title="Copier le code"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copier
                </button>
                {showLoadButton && (
                  <button
                    onClick={loadDataForCurrentCode}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors animate-pulse shadow-lg"
                    title="Charger les données avec ce code"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Charger
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 text-sm">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Users className="w-3.5 h-3.5" />
                  <span>Même code sur tous vos appareils</span>
                </div>
                {!isCodeValid && (
                  <span className="text-red-500 text-xs font-medium bg-red-50 px-2 py-1 rounded">
                    Erreur de connexion
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              <span className="font-medium">Comment ça marche :</span> Entrez le même code sur votre ordinateur et votre smartphone. Toutes les modifications seront synchronisées automatiquement. <strong>Cliquez sur "Charger" après avoir changé le code.</strong>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {apiHealth ? (
                <div className="flex items-center gap-1 text-emerald-600 text-sm">
                  <Wifi className="w-4 h-4" />
                  <span>API SQLite connectée</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-amber-600 text-sm">
                  <WifiOff className="w-4 h-4" />
                  <span>Mode hors ligne</span>
                </div>
              )}
              {queueSize > 0 && (
                <div className="flex items-center gap-1 text-blue-600 text-sm bg-blue-50 px-2 py-1 rounded">
                  <Database className="w-3 h-3" />
                  <span>{queueSize} en attente</span>
                </div>
              )}
            </div>
            
            <button 
              onClick={saveDataToServer}
              disabled={isSaving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? <Cloud className="w-5 h-5 animate-pulse" /> : <Save className="w-5 h-5" />}
              {isSaving ? "Sauvegarde..." : "Sauvegarder sur SQLite"}
            </button>
            
            {lastSaved && !saveError && (
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> 
                Dernière sauvegarde : {lastSaved.toLocaleTimeString('fr-CH', {hour: '2-digit', minute:'2-digit'})}
              </p>
            )}
            {saveError && (
              <p className="text-sm text-red-500 mt-1 flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-4 h-4" /> 
                Erreur de connexion API
              </p>
            )}
          </div>
        </header>

        {/* GUIDE PÉDAGOGIQUE */}
        <div className="bg-indigo-50 rounded-xl shadow-sm border border-indigo-100 p-4">
          <button
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-indigo-800">
                Comprendre les modes de financement & les indicateurs économiques
              </h2>
            </div>
            {isGuideOpen ? (
              <ChevronUp className="w-5 h-5 text-indigo-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-indigo-500" />
            )}
          </button>
          
          {isGuideOpen && (
            <div className="mt-4 pt-4 border-t border-indigo-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Bloc Financements */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-600" />
                    <h3 className="font-bold text-slate-800">Les Financements</h3>
                  </div>
                  <div className="space-y-2 text-sm text-slate-700">
                    <p><strong>Leasing (Crédit-bail)</strong> : Vous payez pour l'utilisation, pas la possession. Idéal si vous changez de voiture tous les 3-4 ans. À Lausanne, c'est une "assurance" contre la dépréciation : si les règles de circulation changent en 2030, c'est la banque qui assume la perte.</p>
                    <p><strong>Crédit Privé</strong> : Vous devenez propriétaire immédiatement. <span className="text-emerald-700 font-medium">Avantage vaudois</span> : les intérêts sont déductibles de votre revenu imposable (réduction de 20-30% selon votre tranche).</p>
                    <p><strong>Achat Comptant</strong> : Attention au coût d'opportunité ! Cet argent ne vous rapporte plus rien sur vos placements (ETF, 3ème pilier). Vous portez 100% du risque de revente.</p>
                  </div>
                </div>

                {/* Bloc Indicateurs */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-slate-800">Les Indicateurs Clés</h3>
                  </div>
                  <div className="space-y-2 text-sm text-slate-700">
                    <p><strong>Taux de Placement (3%)</strong> : Simule le gain manqué sur votre épargne (coût d'opportunité). Si votre épargne rapporte 3% et votre leasing coûte 1,9%, il est mathématiquement plus intelligent de faire un leasing et de laisser votre argent travailler.</p>
                    <p><strong>Inflation (2%)</strong> : Elle "mange" la valeur de l'argent. Si vous avez une dette fixe (Leasing/Crédit), l'inflation joue pour vous : vous remboursez avec des francs qui ont moins de valeur qu'au premier jour.</p>
                  </div>
                </div>

                {/* Bloc Risque & Synthèse */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-slate-800">Risque Marché & Synthèse</h3>
                  </div>
                  <div className="space-y-2 text-sm text-slate-700">
                    <p><strong>Risque de Dépréciation (0-30%)</strong> : Simule l'impact des futures restrictions de circulation à Lausanne (2030) sur la valeur de revente. Ce risque s'applique au <strong>Crédit</strong> et au <strong>Comptant</strong> (vous êtes propriétaire), mais pas au <strong>Leasing</strong> (la banque assume le risque).</p>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                      <p className="text-amber-800 font-medium text-sm">
                        💡 <strong>Le mode le plus intéressant n'est pas forcément celui sans intérêts.</strong> Si votre taux de placement est supérieur au taux de financement, préserver votre capital est souvent la stratégie la plus rentable.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SYNTHÈSE GRAPHIQUE UNIFIÉE (Barres Empilées) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-800">
            <BarChart3 className="w-6 h-6 text-indigo-500" /> 
            Comparaison des Coûts Mensuels (Tous Modes) - Décomposition Détailée
          </h2>
          
          {/* Graphique unifié avec barres empilées */}
          <div className="space-y-6">
            {/* Légende des modes */}
            <div className="flex flex-wrap gap-4 justify-center mb-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-sm font-medium text-slate-700">Leasing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                <span className="text-sm font-medium text-slate-700">Crédit ({tauxCreditGlobal}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-500 rounded"></div>
                <span className="text-sm font-medium text-slate-700">Comptant</span>
              </div>
            </div>

            {/* Légende des segments */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <h4 className="text-xs font-bold text-slate-600 mb-2">Légende des segments (du plus foncé au plus clair) :</h4>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-slate-800 rounded"></div>
                  <span className="text-xs text-slate-700">Financement</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-slate-600 rounded"></div>
                  <span className="text-xs text-slate-700">Énergie</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-slate-400 rounded"></div>
                  <span className="text-xs text-slate-700">Frais Fixes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-slate-300 rounded"></div>
                  <span className="text-xs text-slate-700">Entretien</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-slate-200 rounded"></div>
                  <span className="text-xs text-slate-700">Opportunité</span>
                </div>
              </div>
            </div>
            
            {/* Graphique principal avec barres empilées */}
            <div className="space-y-4">
              {(() => {
                // Créer un tableau plat avec toutes les données
                const allData = [];
                results.forEach(r => {
                  allData.push(
                    { 
                      type: 'leasing', 
                      vehicle: r.name, 
                      breakdown: r.leasing.breakdown,
                      color: 'blue',
                      total: r.leasing.tco
                    },
                    { 
                      type: 'credit', 
                      vehicle: r.name, 
                      breakdown: r.credit.breakdown,
                      color: 'emerald',
                      total: r.credit.tco
                    },
                    { 
                      type: 'comptant', 
                      vehicle: r.name, 
                      breakdown: r.comptant.breakdown,
                      color: 'purple',
                      total: r.comptant.tco
                    }
                  );
                });
                
                // Trier par valeur croissante
                allData.sort((a, b) => a.total - b.total);
                
                // Trouver la valeur max pour l'échelle
                const maxValue = Math.max(...allData.map(d => d.total), 1);
                
                // Définir les catégories et couleurs
                const categories = [
                  { key: 'financement', label: 'Financement', tooltip: 'Loyer leasing, mensualité crédit ou amortissement net cash' },
                  { key: 'energie', label: 'Énergie', tooltip: 'Mix Électricité + Essence selon le type de moteur' },
                  { key: 'fraisFixes', label: 'Frais Fixes', tooltip: 'Assurance + Impôt Vaud + Macaron Lausanne + Parking' },
                  { key: 'entretien', label: 'Entretien', tooltip: 'Provision mensuelle maintenance' },
                  { key: 'opportunite', label: 'Opportunité', tooltip: 'Manque à gagner sur le placement financier' }
                ];

                // Couleurs selon le type
                const colorSchemes = {
                  blue: {
                    financement: 'bg-blue-800',
                    energie: 'bg-blue-600',
                    fraisFixes: 'bg-blue-400',
                    entretien: 'bg-blue-300',
                    opportunite: 'bg-sky-200'
                  },
                  emerald: {
                    financement: 'bg-emerald-800',
                    energie: 'bg-emerald-600',
                    fraisFixes: 'bg-emerald-400',
                    entretien: 'bg-emerald-300',
                    opportunite: 'bg-green-200'
                  },
                  purple: {
                    financement: 'bg-purple-800',
                    energie: 'bg-purple-600',
                    fraisFixes: 'bg-purple-400',
                    entretien: 'bg-purple-300',
                    opportunite: 'bg-fuchsia-200'
                  }
                };

                return allData.map((item, index) => {
                  const colors = colorSchemes[item.color];
                  const typeLabel = item.type === 'leasing' ? 'Leasing' : item.type === 'credit' ? 'Crédit' : 'Comptant';
                  
                  return (
                    <div key={`unified-stacked-${index}`} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 ${item.type === 'leasing' ? 'bg-blue-500' : item.type === 'credit' ? 'bg-emerald-500' : 'bg-purple-500'} rounded`}></div>
                          <span className="font-medium text-slate-700 text-sm">
                            {item.vehicle} - {typeLabel}
                          </span>
                        </div>
                        <span className={`font-bold ${item.type === 'leasing' ? 'text-blue-700' : item.type === 'credit' ? 'text-emerald-700' : 'text-purple-700'} text-sm`}>
                          {item.total.toFixed(0)} CHF
                        </span>
                      </div>
                      
                      {/* Barre empilée */}
                      <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden flex relative group">
                        {categories.map(category => {
                          const value = item.breakdown[category.key];
                          const percentage = (value / item.total) * 100;
                          const widthPercentage = (value / maxValue) * 100;
                          
                          if (value <= 0) return null;
                          
                          return (
                            <Tooltip
                              key={`${index}-${category.key}`}
                              content={`${category.label}: ${value.toFixed(0)} CHF`}
                              position="top"
                            >
                              <div
                                className={`h-full ${colors[category.key]} transition-all duration-300 hover:opacity-90`}
                                style={{ width: `${widthPercentage}%` }}
                              >
                                <div className="relative w-full h-full">
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                      {value.toFixed(0)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            
            {/* Résumé statistique */}
            {results.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-200">
                <h3 className="font-bold text-slate-700 mb-4">Résumé par Mode de Financement</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-blue-800 font-bold text-lg">Leasing</div>
                    <div className="text-2xl font-black text-blue-700 mt-1">
                      {(results.reduce((sum, r) => sum + r.leasing.tco, 0) / results.length).toFixed(0)} CHF
                    </div>
                    <div className="text-sm text-blue-600 mt-1">Moyenne mensuelle</div>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-lg">
                    <div className="text-emerald-800 font-bold text-lg">Crédit</div>
                    <div className="text-2xl font-black text-emerald-700 mt-1">
                      {(results.reduce((sum, r) => sum + r.credit.tco, 0) / results.length).toFixed(0)} CHF
                    </div>
                    <div className="text-sm text-emerald-600 mt-1">Moyenne mensuelle</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-purple-800 font-bold text-lg">Comptant</div>
                    <div className="text-2xl font-black text-purple-700 mt-1">
                      {(results.reduce((sum, r) => sum + r.comptant.tco, 0) / results.length).toFixed(0)} CHF
                    </div>
                    <div className="text-sm text-purple-600 mt-1">Moyenne mensuelle</div>
                  </div>
                </div>
                
                {/* Meilleure option par véhicule */}
                <div className="mt-6">
                  <h4 className="font-bold text-slate-700 mb-3">Meilleure Option par Véhicule</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 font-medium text-slate-500">Véhicule</th>
                          <th className="text-right py-2 font-medium text-slate-500">Leasing</th>
                          <th className="text-right py-2 font-medium text-slate-500">Crédit</th>
                          <th className="text-right py-2 font-medium text-slate-500">Comptant</th>
                          <th className="text-right py-2 font-medium text-slate-500">Meilleur choix</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, index) => {
                          const tcoLeasing = r.leasing.tco;
                          const tcoCredit = r.credit.tco;
                          const tcoComptant = r.comptant.tco;
                          const minTCO = Math.min(tcoLeasing, tcoCredit, tcoComptant);
                          const bestType = minTCO === tcoLeasing ? 'leasing' : minTCO === tcoCredit ? 'credit' : 'comptant';
                          const bestColor = bestType === 'leasing' ? 'text-blue-600' : bestType === 'credit' ? 'text-emerald-600' : 'text-purple-600';
                          
                          return (
                            <tr key={`best-${r.id}`} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-2 font-medium text-slate-700">{r.name}</td>
                              <td className={`text-right py-2 font-bold ${minTCO === tcoLeasing ? 'text-blue-700' : 'text-slate-600'}`}>{tcoLeasing.toFixed(0)}</td>
                              <td className={`text-right py-2 font-bold ${minTCO === tcoCredit ? 'text-emerald-700' : 'text-slate-600'}`}>{tcoCredit.toFixed(0)}</td>
                              <td className={`text-right py-2 font-bold ${minTCO === tcoComptant ? 'text-purple-700' : 'text-slate-600'}`}>{tcoComptant.toFixed(0)}</td>
                              <td className={`text-right py-2 font-bold ${bestColor}`}>
                                {bestType === 'leasing' && 'Leasing'}
                                {bestType === 'credit' && 'Crédit'}
                                {bestType === 'comptant' && 'Comptant'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PARAMÈTRES GLOBAUX */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-indigo-800">
            <Wallet className="w-5 h-5" /> Paramètres d'Usage & Économiques
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-10 gap-4">
             <div className="col-span-1">
               <label className="block text-xs font-medium text-slate-500">Durée (mois)</label>
               <NumericInput
                 value={dureeMois} 
                 onChange={setDureeMois}
                 className="w-full p-2 border rounded-md" 
               />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-slate-500">Km annuel</label>
               <NumericInput
                 value={kmAnnuel} 
                 onChange={setKmAnnuel}
                 className="w-full p-2 border rounded-md" 
               />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-slate-500">Parking /mois</label>
               <NumericInput
                 value={parking} 
                 onChange={setParking}
                 className="w-full p-2 border rounded-md" 
               />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-slate-500">Vignette /an</label>
               <NumericInput
                 value={vignette} 
                 onChange={setVignette}
                 className="w-full p-2 border rounded-md" 
               />
             </div>
             <div className="col-span-1 border-l border-slate-200 pl-4">
               <label className="block text-xs font-bold text-emerald-600">Crédit (%)</label>
               <NumericInput
                 value={tauxCreditGlobal} 
                 onChange={setTauxCreditGlobal}
                 className="w-full p-2 border border-emerald-300 rounded-md bg-emerald-50 text-emerald-900 font-bold" 
               />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-amber-600">Inflation (%)</label>
               <NumericInput
                 value={inflationAnnuelle} 
                 onChange={setInflationAnnuelle}
                 className="w-full p-2 border border-amber-300 rounded-md bg-amber-50 text-amber-900" 
               />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-cyan-600">Placement (%)</label>
               <NumericInput
                 value={tauxPlacement} 
                 onChange={setTauxPlacement}
                 className="w-full p-2 border border-cyan-300 rounded-md bg-cyan-50 text-cyan-900" 
               />
             </div>
             <div className="col-span-1 border-l border-slate-200 pl-4">
               <label className="block text-xs font-medium text-orange-600">Essence (CHF/L)</label>
               <NumericInput
                 value={prixEssence} 
                 onChange={setPrixEssence}
                 className="w-full p-2 border border-orange-300 rounded-md bg-orange-50 text-orange-900" 
               />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-blue-600">Électricité (CHF/kWh)</label>
               <NumericInput
                 value={prixElec} 
                 onChange={setPrixElec}
                 className="w-full p-2 border border-blue-300 rounded-md bg-blue-50 text-blue-900" 
               />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-purple-600">% Électrique</label>
               <NumericInput
                 value={ratioElec} 
                 onChange={setRatioElec}
                 className="w-full p-2 border border-purple-300 rounded-md bg-purple-50 text-purple-900" 
               />
               <div className="text-xs text-purple-500 mt-1">
                 S'applique uniquement aux véhicules PHEV
               </div>
             </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">
            <span className="font-medium">Coût d'opportunité :</span> Le taux de placement représente le rendement annuel que vous pourriez obtenir en investissant votre argent plutôt que de l'utiliser pour acheter un véhicule. Ce coût est inclus dans le TCO.
          </div>
        </div>

        {/* GRILLE DES VÉHICULES (HORIZONTALE) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
          {cars.map((car, index) => (
            <div key={car.id} className="bg-white rounded-xl shadow-md border border-slate-200 flex flex-col relative group">
              
              {/* Entête Véhicule avec % valeur résiduelle */}
              <div className="bg-slate-800 p-4 rounded-t-xl flex justify-between items-center">
                <div className="flex-1">
                  <input 
                    type="text" 
                    value={car.name} 
                    onChange={e => updateCar(index, 'name', e.target.value)}
                    className="w-full bg-slate-700 text-white font-bold text-lg p-2 rounded border-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
                    placeholder={`Véhicule ${index + 1}`}
                  />
                </div>
                <button 
                  onClick={() => removeCar(car.id)}
                  disabled={cars.length === 1}
                  className="text-slate-400 hover:text-red-400 disabled:opacity-30 transition-colors ml-2"
                  title="Supprimer ce véhicule"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Contenu en 2 colonnes : Formulaire + Résultats */}
              <div className="flex flex-col lg:flex-row flex-grow">
                {/* Colonne GAUCHE : Formulaire */}
                <div className="lg:w-1/2 p-4 space-y-3 border-r border-slate-100">
                  {/* Photo URL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase">URL de la photo</label>
                    <input 
                      type="text" 
                      value={car.photoUrl} 
                      onChange={e => updateCar(index, 'photoUrl', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                      placeholder="https://example.com/photo.jpg"
                    />
                    {car.photoUrl && (
                      <div className="mt-2 relative">
                        <img 
                          src={car.photoUrl} 
                          alt={car.name}
                          className="w-full h-32 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => openImageModal(car.photoUrl, car.name)}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div class="text-xs text-slate-400 italic">Image non disponible</div>';
                          }}
                        />
                        <button
                          onClick={() => openImageModal(car.photoUrl, car.name)}
                          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-colors"
                          title="Agrandir l'image"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Type de Motorisation */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase">Type de Motorisation</label>
                    <select
                      value={car.motorisation || 'PHEV'}
                      onChange={e => updateCar(index, 'motorisation', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value="ICE">ICE (Thermique)</option>
                      <option value="PHEV">PHEV (Hybride Rechargeable)</option>
                      <option value="BEV">BEV (100% Électrique)</option>
                    </select>
                    <div className="text-xs text-slate-500 mt-1">
                      {car.motorisation === 'ICE' && 'Calcul uniquement sur la consommation essence'}
                      {car.motorisation === 'BEV' && 'Calcul uniquement sur la consommation électrique'}
                      {car.motorisation === 'PHEV' && 'Calcul mixte selon le % électrique'}
                    </div>
                  </div>

                  {/* Commentaire */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase">Commentaire</label>
                    <textarea 
                      value={car.commentaire} 
                      onChange={e => updateCar(index, 'commentaire', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white h-20"
                      placeholder="Notes, observations, détails..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase">Prix TTC (CHF)</label>
                    <NumericInput
                      value={car.prixAchat}
                      onChange={val => updateCar(index, 'prixAchat', val)}
                      className="w-full p-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-slate-50"
                      placeholder="ex: 52037.50"
                    />
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg space-y-2">
                    <span className="text-xs font-bold text-blue-800 uppercase">Conditions leasing</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-blue-700">Apport</label>
                        <NumericInput
                          value={car.apport}
                          onChange={val => updateCar(index, 'apport', val)}
                          className="w-full p-1.5 border border-blue-200 rounded text-sm bg-white"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-700">Taux (%)</label>
                        <NumericInput
                          value={car.tauxLeasing}
                          onChange={val => updateCar(index, 'tauxLeasing', val)}
                          className="w-full p-1.5 border border-blue-200 rounded text-sm bg-white font-bold"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg space-y-2">
                    <span className="text-xs font-bold text-emerald-800 uppercase">Conditions crédit</span>
                    <div>
                      <label className="block text-xs text-emerald-700">Apport crédit (différent du leasing)</label>
                      <NumericInput
                        value={car.apportCredit} 
                        onChange={val => updateCar(index, 'apportCredit', val)}
                        className="w-full p-1.5 border border-emerald-200 rounded text-sm bg-white" 
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase">Valeur Résiduelle (CHF)</label>
                        {car.prixAchat > 0 && (
                          <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                            {((car.valeurResiduelle / car.prixAchat) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <NumericInput
                        value={car.valeurResiduelle} 
                        onChange={val => updateCar(index, 'valeurResiduelle', val)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm" 
                        placeholder="0.00"
                      />
                    </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Assurance</label>
                      <NumericInput
                        value={car.assurance} 
                        onChange={val => updateCar(index, 'assurance', val)}
                        className="w-full p-1.5 border border-slate-200 rounded text-sm" 
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Impôt</label>
                      <NumericInput
                        value={car.impotCantonal} 
                        onChange={val => updateCar(index, 'impotCantonal', val)}
                        className="w-full p-1.5 border border-slate-200 rounded text-sm" 
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Entretien</label>
                      <NumericInput
                        value={car.entretien} 
                        onChange={val => updateCar(index, 'entretien', val)}
                        className="w-full p-1.5 border border-slate-200 rounded text-sm" 
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Conso Élec (kWh/100km)</label>
                      <NumericInput
                        value={car.consoElec} 
                        onChange={val => updateCar(index, 'consoElec', val)}
                        className="w-full p-1.5 border border-slate-200 rounded text-sm" 
                        placeholder="0.0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Conso Essence (L/100km)</label>
                      <NumericInput
                        value={car.consoEssence} 
                        onChange={val => updateCar(index, 'consoEssence', val)}
                        className="w-full p-1.5 border border-slate-200 rounded text-sm" 
                        placeholder="0.0"
                      />
                    </div>
                    <div className="relative">
                      <label className="block text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Risque Marché (%)
                      </label>
                      <NumericInput
                        value={car.risqueDepreciation} 
                        onChange={val => updateCar(index, 'risqueDepreciation', val)}
                        className="w-full p-1.5 border border-amber-300 rounded text-sm bg-amber-50" 
                        placeholder="0-30"
                      />
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center" title="Impact sur la valeur de revente">
                        !
                      </div>
                    </div>
                  </div>
                </div>

                {/* Colonne DROITE : Résultats */}
                <div className="lg:w-1/2 p-4 bg-slate-50 flex flex-col gap-3 rounded-b-xl lg:rounded-br-xl lg:rounded-bl-none">
                  
                  <div className="text-center bg-white py-2 px-3 rounded shadow-sm border border-slate-200">
                    <span className="text-xs text-slate-500 uppercase font-bold">Usage Mensuel</span>
                    <div className="font-bold text-slate-700 text-xl mt-1">{results[index].fraisUsage.toFixed(0)} <span className="text-sm font-normal">CHF</span></div>
                  </div>

                  {/* Graphiques TCO Empilés */}
                  <div className="space-y-4">
                    <div className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm">
                      <StackedBarChart 
                        breakdown={results[index].leasing.breakdown}
                        type="leasing"
                        vehicleName={car.name}
                        motorisation={car.motorisation}
                      />
                    </div>

                    <div className="bg-white border border-emerald-200 rounded-lg p-3 shadow-sm">
                      <StackedBarChart 
                        breakdown={results[index].credit.breakdown}
                        type="credit"
                        vehicleName={car.name}
                        motorisation={car.motorisation}
                      />
                    </div>

                    <div className="bg-white border border-purple-200 rounded-lg p-3 shadow-sm">
                      <StackedBarChart 
                        breakdown={results[index].comptant.breakdown}
                        type="comptant"
                        vehicleName={car.name}
                        motorisation={car.motorisation}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* BOUTON AJOUTER */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3 flex justify-center mt-4">
            <button 
              onClick={addCar}
              className="w-full max-w-md rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 flex flex-col items-center justify-center text-slate-500 hover:text-indigo-600 transition-all group p-8"
            >
              <div className="w-16 h-16 bg-slate-100 group-hover:bg-indigo-100 rounded-full flex items-center justify-center mb-4 transition-colors">
                <Plus className="w-8 h-8" />
              </div>
              <span className="font-bold text-lg">Ajouter un véhicule</span>
              <span className="text-sm mt-1 opacity-70">Comparer une autre offre</span>
            </button>
          </div>
        </div>

      </div>

      {/* MODAL D'IMAGE */}
      {modalImage.isOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={closeImageModal}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"
              title="Fermer"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="bg-white rounded-lg overflow-hidden shadow-2xl">
              <div className="p-4 bg-slate-800 text-white">
                <h3 className="font-bold text-lg">{modalImage.title}</h3>
              </div>
              <div className="flex items-center justify-center bg-black">
                <img
                  src={modalImage.url}
                  alt={modalImage.title}
                  className="max-h-[70vh] max-w-full object-contain"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmMWYxIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiI+SW1hZ2Ugbm9uIGRpc3BvbmlibGU8L3RleHQ+PC9zdmc+';
                  }}
                />
              </div>
              <div className="p-4 bg-slate-100 flex justify-between items-center">
                <span className="text-sm text-slate-600 truncate">{modalImage.url}</span>
                <button
                  onClick={() => window.open(modalImage.url, '_blank')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                  title="Ouvrir dans un nouvel onglet"
                >
                  <Maximize2 className="w-4 h-4" />
                  Ouvrir dans un nouvel onglet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
