import React, { useState, useEffect } from 'react';
import { Calculator, Car, Save, Cloud, CheckCircle, Wallet, Plus, Trash2, BarChart3, AlertCircle, Key, Users, Copy, X, Maximize2, Download, Database, Wifi, WifiOff } from 'lucide-react';
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

// Fonction utilitaire pour convertir les nombres avec séparateurs décimaux
const parseDecimal = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  
  // Si la chaîne est vide, retourner 0
  if (value.trim() === '') return 0;
  
  // Remplacer les virgules par des points (compatibilité avec les deux formats)
  const normalized = value.replace(',', '.');
  
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

// Fonction pour gérer la saisie des nombres (accepte les virgules et points)
const handleNumberInput = (value, setter) => {
  // Permettre la suppression complète
  if (value === '') {
    setter('');
    return;
  }
  
  // Remplacer les virgules par des points pour le parsing
  const normalized = value.replace(',', '.');
  
  // Vérifier si c'est un nombre valide
  if (/^-?\d*\.?\d*$/.test(normalized)) {
    setter(value); // Garder la valeur telle quelle (avec virgule si l'utilisateur l'a tapée)
  }
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

  // --- PARAMÈTRES GLOBAUX ---
  const [dureeMois, setDureeMois] = useState(48);
  const [kmAnnuel, setKmAnnuel] = useState(15000);
  const [parking, setParking] = useState(0); 
  const [vignette, setVignette] = useState(40); 
  const [tauxCreditGlobal, setTauxCreditGlobal] = useState(4.9);
  const [inflationAnnuelle, setInflationAnnuelle] = useState(2.0);
  const [tauxPlacement, setTauxPlacement] = useState(3.0);

  // --- VÉHICULES (Tableau d'objets dynamique) ---
  const [cars, setCars] = useState(() => {
    // Charger les données par défaut immédiatement pour éviter le flash
    return [
      {
        id: 1,
        name: "Votre Devis Actuel",
        photoUrl: "",
        commentaire: "",
        prixAchat: 52037,
        apport: 15000,
        apportCredit: 15000, // Apport spécifique pour le crédit
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
                          'assurance', 'impotCantonal', 'consommation', 'prixCarburant', 'entretien'];
    
    if (numericFields.includes(field)) {
      newCars[index][field] = parseDecimal(value);
    } else {
      newCars[index][field] = value;
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
      const capitalFinance = car.prixAchat - car.apport;

      // 1. LEASING
      const rLeasing = (car.tauxLeasing / 100) / 12;
      let pmtLeasing = 0;
      if (rLeasing > 0) {
        const facteur = Math.pow(1 + rLeasing, -dureeMois);
        const denom = (1 - facteur) / rLeasing;
        pmtLeasing = (capitalFinance - (car.valeurResiduelle * facteur)) / (denom * (1 + rLeasing));
      } else {
        pmtLeasing = (capitalFinance - car.valeurResiduelle) / dureeMois;
      }
      const coutVehiculeLisseLeasing = (car.apport + (pmtLeasing * dureeMois)) / dureeMois;

      // 2. CRÉDIT (utilise apportCredit spécifique)
      const capitalFinanceCredit = car.prixAchat - car.apportCredit;
      const rCredit = (tauxCreditGlobal / 100) / 12;
      let pmtCredit = 0;
      if (rCredit > 0) {
        pmtCredit = capitalFinanceCredit * (rCredit / (1 - Math.pow(1 + rCredit, -dureeMois)));
      } else {
        pmtCredit = capitalFinanceCredit / dureeMois;
      }
      const coutVehiculeLisseCredit = (car.apportCredit + (pmtCredit * dureeMois) - car.valeurResiduelle) / dureeMois;

      // 3. COMPTANT
      const coutVehiculeLisseComptant = (car.prixAchat - car.valeurResiduelle) / dureeMois;

      // Frais Fixes et Variables
      const coutFixeMensuel = (car.assurance + car.impotCantonal + vignette) / 12 + parking;
      const coutCarburantAnnuel = (kmAnnuel / 100) * car.consommation * car.prixCarburant;
      const coutVariableMensuel = (coutCarburantAnnuel + car.entretien) / 12;
      const fraisUsage = coutFixeMensuel + coutVariableMensuel;

      return {
        ...car,
        fraisUsage,
        leasing: {
          pmt: pmtLeasing > 0 ? pmtLeasing : 0,
          tco: coutVehiculeLisseLeasing + fraisUsage
        },
        credit: {
          pmt: pmtCredit > 0 ? pmtCredit : 0,
          tco: coutVehiculeLisseCredit + fraisUsage
        },
        comptant: {
          tco: coutVehiculeLisseComptant + fraisUsage
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

        {/* SYNTHÈSE GRAPHIQUE UNIFIÉE */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-800">
            <BarChart3 className="w-6 h-6 text-indigo-500" /> 
            Comparaison des Coûts Mensuels (Tous Modes)
          </h2>
          
          {/* Graphique unifié avec toutes les barres */}
          <div className="space-y-6">
            {/* Légende */}
            <div className="flex flex-wrap gap-4 justify-center">
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
            
            {/* Graphique principal */}
            <div className="space-y-4">
              {(() => {
                // Créer un tableau plat avec toutes les données
                const allData = [];
                results.forEach(r => {
                  allData.push(
                    { type: 'leasing', vehicle: r.name, value: r.leasing.tco, color: 'bg-blue-500', textColor: 'text-blue-700' },
                    { type: 'credit', vehicle: r.name, value: r.credit.tco, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
                    { type: 'comptant', vehicle: r.name, value: r.comptant.tco, color: 'bg-purple-500', textColor: 'text-purple-700' }
                  );
                });
                
                // Trier par valeur croissante
                allData.sort((a, b) => a.value - b.value);
                
                // Trouver la valeur max pour l'échelle
                const maxValue = Math.max(...allData.map(d => d.value), 1);
                
                return allData.map((item, index) => (
                  <div key={`unified-${index}`} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 ${item.color} rounded`}></div>
                        <span className="font-medium text-slate-700 text-sm">
                          {item.vehicle} - {item.type === 'leasing' ? 'Leasing' : item.type === 'credit' ? 'Crédit' : 'Comptant'}
                        </span>
                      </div>
                      <span className={`font-bold ${item.textColor} text-sm`}>{item.value.toFixed(0)} CHF</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                      <div 
                        className={`${item.color} h-4 rounded-full transition-all duration-500`}
                        style={{ width: `${(item.value / maxValue) * 100}%` }}
                        title={`${item.vehicle} - ${item.type === 'leasing' ? 'Leasing' : item.type === 'credit' ? 'Crédit' : 'Comptant'}: ${item.value.toFixed(0)} CHF`}
                      ></div>
                    </div>
                  </div>
                ));
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
             <div className="col-span-1">
               <label className="block text-xs font-medium text-slate-500">Durée (mois)</label>
               <input 
                 type="text" 
                 inputMode="numeric"
                 value={dureeMois} 
                 onChange={e => handleNumberInput(e.target.value, setDureeMois)} 
                 className="w-full p-2 border rounded-md" 
               />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-slate-500">Km annuel</label>
               <input 
                 type="text" 
                 inputMode="numeric"
                 value={kmAnnuel} 
                 onChange={e => handleNumberInput(e.target.value, setKmAnnuel)} 
                 className="w-full p-2 border rounded-md" 
               />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-slate-500">Parking /mois</label>
               <input 
                 type="text" 
                 inputMode="decimal"
                 value={parking} 
                 onChange={e => handleNumberInput(e.target.value, setParking)} 
                 className="w-full p-2 border rounded-md" 
               />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-slate-500">Vignette /an</label>
               <input 
                 type="text" 
                 inputMode="numeric"
                 value={vignette} 
                 onChange={e => handleNumberInput(e.target.value, setVignette)} 
                 className="w-full p-2 border rounded-md" 
               />
             </div>
             <div className="col-span-1 border-l border-slate-200 pl-4">
               <label className="block text-xs font-bold text-emerald-600">Crédit (%)</label>
               <input 
                 type="text" 
                 inputMode="decimal"
                 value={tauxCreditGlobal} 
                 onChange={e => handleNumberInput(e.target.value, setTauxCreditGlobal)} 
                 className="w-full p-2 border border-emerald-300 rounded-md bg-emerald-50 text-emerald-900 font-bold" 
               />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-amber-600">Inflation (%)</label>
               <input 
                 type="text" 
                 inputMode="decimal"
                 value={inflationAnnuelle} 
                 onChange={e => handleNumberInput(e.target.value, setInflationAnnuelle)} 
                 className="w-full p-2 border border-amber-300 rounded-md bg-amber-50 text-amber-900" 
               />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-cyan-600">Placement (%)</label>
               <input 
                 type="text" 
                 inputMode="decimal"
                 value={tauxPlacement} 
                 onChange={e => handleNumberInput(e.target.value, setTauxPlacement)} 
                 className="w-full p-2 border border-cyan-300 rounded-md bg-cyan-50 text-cyan-900" 
               />
             </div>
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
                    <input 
                      type="text" 
                      inputMode="decimal"
                      value={car.prixAchat} 
                      onChange={e => handleNumberInput(e.target.value, (val) => updateCar(index, 'prixAchat', val))}
                      className="w-full p-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-slate-50" 
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg space-y-2">
                    <span className="text-xs font-bold text-blue-800 uppercase">Conditions leasing</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-blue-700">Apport</label>
                        <input 
                          type="text" 
                          inputMode="decimal"
                          value={car.apport} 
                          onChange={e => handleNumberInput(e.target.value, (val) => updateCar(index, 'apport', val))}
                          className="w-full p-1.5 border border-blue-200 rounded text-sm bg-white" 
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-700">Taux (%)</label>
                        <input 
                          type="text" 
                          inputMode="decimal"
                          value={car.tauxLeasing} 
                          onChange={e => handleNumberInput(e.target.value, (val) => updateCar(index, 'tauxLeasing', val))}
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
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={car.apportCredit} 
                        onChange={e => handleNumberInput(e.target.value, (val) => updateCar(index, 'apportCredit', val))}
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
                    <input 
                      type="text" 
                      inputMode="decimal"
                      value={car.valeurResiduelle} 
                      onChange={e => handleNumberInput(e.target.value, (val) => updateCar(index, 'valeurResiduelle', val))}
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm" 
                      placeholder="0.00"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Assurance</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={car.assurance} 
                        onChange={e => handleNumberInput(e.target.value, (val) => updateCar(index, 'assurance', val))}
                        className="w-full p-1.5 border border-slate-200 rounded text-sm" 
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Impôt</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={car.impotCantonal} 
                        onChange={e => handleNumberInput(e.target.value, (val) => updateCar(index, 'impotCantonal', val))}
                        className="w-full p-1.5 border border-slate-200 rounded text-sm" 
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Entretien</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={car.entretien} 
                        onChange={e => handleNumberInput(e.target.value, (val) => updateCar(index, 'entretien', val))}
                        className="w-full p-1.5 border border-slate-200 rounded text-sm" 
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Conso</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={car.consommation} 
                        onChange={e => handleNumberInput(e.target.value, (val) => updateCar(index, 'consommation', val))}
                        className="w-full p-1.5 border border-slate-200 rounded text-sm" 
                        placeholder="0.0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Prix carburant/énergie (CHF)</label>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      value={car.prixCarburant} 
                      onChange={e => handleNumberInput(e.target.value, (val) => updateCar(index, 'prixCarburant', val))}
                      className="w-full p-1.5 border border-slate-200 rounded text-sm" 
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Colonne DROITE : Résultats */}
                <div className="lg:w-1/2 p-4 bg-slate-50 flex flex-col gap-3 rounded-b-xl lg:rounded-br-xl lg:rounded-bl-none">
                  
                  <div className="text-center bg-white py-2 px-3 rounded shadow-sm border border-slate-200">
                    <span className="text-xs text-slate-500 uppercase font-bold">Usage Mensuel</span>
                    <div className="font-bold text-slate-700 text-xl mt-1">{results[index].fraisUsage.toFixed(0)} <span className="text-sm font-normal">CHF</span></div>
                  </div>

                  {/* LEASING */}
                  <div className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="font-bold text-blue-800 text-sm block">Leasing (TCO)</span>
                        <span className="text-[10px] text-blue-600">Mensuel banque: {results[index].leasing.pmt.toFixed(0)} CHF</span>
                      </div>
                      <span className="text-xl font-black text-blue-700">{results[index].leasing.tco.toFixed(0)} <span className="text-sm font-normal">CHF</span></span>
                    </div>
                  </div>

                  {/* CRÉDIT */}
                  <div className="bg-white border border-emerald-200 rounded-lg p-3 shadow-sm">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="font-bold text-emerald-800 text-sm block">Crédit (TCO)</span>
                        <span className="text-[10px] text-emerald-600">Mensuel banque: {results[index].credit.pmt.toFixed(0)} CHF</span>
                      </div>
                      <span className="text-xl font-black text-emerald-700">{results[index].credit.tco.toFixed(0)} <span className="text-sm font-normal">CHF</span></span>
                    </div>
                  </div>

                  {/* COMPTANT */}
                  <div className="bg-white border border-purple-200 rounded-lg p-3 shadow-sm">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="font-bold text-purple-800 text-sm block">Comptant</span>
                        <span className="text-[10px] text-purple-600">TCO sans intérêts</span>
                      </div>
                      <span className="text-xl font-black text-purple-700">{results[index].comptant.tco.toFixed(0)} <span className="text-sm font-normal">CHF</span></span>
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
