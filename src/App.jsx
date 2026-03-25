import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Car, Save, Cloud, CheckCircle, Wallet, Plus, Trash2, BarChart3, AlertCircle, Key, Users, Copy, X, Maximize2, Download, Database, Wifi, WifiOff, Info, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchData, saveData, checkHealth, processSyncQueue, getQueueSize } from './api';
import NumericInput from './components/NumericInput';
import Tooltip from './components/Tooltip';
import StackedBarChart from './components/StackedBarChart';
import { calculateResults, calculateMaxTCO, parseDecimal } from './utils/calculations';

const App = () => {
  // --- ÉTAT GLOBAL GÉNÉRAL ---
  const [sharedCode, setSharedCode] = useState(() => {
    return localStorage.getItem('comparateur_shared_code') || 'COMP123';
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [apiHealth, setApiHealth] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [isCodeValid, setIsCodeValid] = useState(true);
  const [showLoadButton, setShowLoadButton] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(true);

  // --- ÉTAT FILTRE PANEL LATÉRAL ---
  const [filterMode, setFilterMode] = useState('all');

  // --- ÉTAT MODAL IMAGE ---
  const [modalImage, setModalImage] = useState({
    isOpen: false,
    url: '',
    title: ''
  });

  // --- PARAMÈTRES GLOBAUX ---
  const [dureeMois, setDureeMois] = useState(48);
  const [dureeDetention, setDureeDetention] = useState(96);
  const [kmAnnuel, setKmAnnuel] = useState(15000);
  const [parking, setParking] = useState(0);
  const [vignette, setVignette] = useState(40);
  const [tauxCreditGlobal, setTauxCreditGlobal] = useState(4.9);
  const [inflationAnnuelle, setInflationAnnuelle] = useState(2.0);
  const [tauxPlacement, setTauxPlacement] = useState(3.0);
  const [prixEssence, setPrixEssence] = useState(1.85);
  const [prixElec, setPrixElec] = useState(0.33);
  const [ratioElec, setRatioElec] = useState(80);

  // --- VÉHICULES ---
  const [cars, setCars] = useState(() => {
    return [
      {
        id: 1,
        name: "Votre Devis Actuel",
        photoUrl: "",
        commentaire: "",
        motorisation: 'PHEV',
        prixAchat: 52037,
        apport: 15000,
        apportCredit: 15000,
        tauxLeasing: 0.99,
        valeurResiduelle: 23784,
        assurance: 1500,
        impotCantonal: 450,
        consoElec: 0,
        consoEssence: 7.5,
        risqueDepreciation: 10,
        entretien: 0
      },
      {
        id: 2,
        name: "Break Hybride (Exemple)",
        photoUrl: "",
        commentaire: "",
        motorisation: 'PHEV',
        prixAchat: 46000,
        apport: 10000,
        apportCredit: 10000,
        tauxLeasing: 2.9,
        valeurResiduelle: 18000,
        assurance: 1300,
        impotCantonal: 250,
        consoElec: 15,
        consoEssence: 5.5,
        risqueDepreciation: 15,
        entretien: 700
      },
      {
        id: 3,
        name: "Électrique Familiale",
        photoUrl: "",
        commentaire: "",
        motorisation: 'BEV',
        prixAchat: 56000,
        apport: 15000,
        apportCredit: 15000,
        tauxLeasing: 1.5,
        valeurResiduelle: 26000,
        assurance: 1600,
        impotCantonal: 0,
        consoElec: 18,
        consoEssence: 0,
        risqueDepreciation: 20,
        entretien: 300
      }
    ];
  });

  // --- CALCULS OPTIMISÉS ---
  const settings = useMemo(() => ({
    dureeMois,
    dureeDetention,
    kmAnnuel,
    parking,
    vignette,
    tauxCreditGlobal,
    inflationAnnuelle,
    tauxPlacement,
    prixEssence,
    prixElec,
    ratioElec
  }), [dureeMois, dureeDetention, kmAnnuel, parking, vignette, tauxCreditGlobal, inflationAnnuelle, tauxPlacement, prixEssence, prixElec, ratioElec]);

  const results = useMemo(() => calculateResults(cars, settings), [cars, settings]);
  const maxTCO = useMemo(() => calculateMaxTCO(results), [results]);

  // --- ACTIONS SUR LES VÉHICULES ---
  const updateCar = (index, field, value) => {
    const newCars = [...cars];
    const numericFields = ['prixAchat', 'apport', 'apportCredit', 'tauxLeasing', 'valeurResiduelle', 
                          'assurance', 'impotCantonal', 'consoElec', 'consoEssence', 'risqueDepreciation', 'entretien'];
    
    if (numericFields.includes(field)) {
      newCars[index][field] = parseDecimal(value);
    } else {
      newCars[index][field] = value;
    }

    if (field === 'motorisation') {
      const car = newCars[index];
      switch (value) {
        case 'ICE':
          if (car.impotCantonal < 400) car.impotCantonal = 450;
          if (car.risqueDepreciation < 15) car.risqueDepreciation = 20;
          car.consoElec = 0;
          break;
        case 'BEV':
          car.impotCantonal = 0;
          if (car.risqueDepreciation > 10) car.risqueDepreciation = 5;
          car.consoEssence = 0;
          break;
        case 'PHEV':
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
      motorisation: 'PHEV',
      prixAchat: 40000,
      apport: 10000,
      apportCredit: 10000,
      tauxLeasing: 2.9,
      valeurResiduelle: 15000,
      assurance: 1200,
      impotCantonal: 300,
      consoElec: 10,
      consoEssence: 5.0,
      risqueDepreciation: 15,
      entretien: 500
    }]);
  };

  const removeCar = (idToRemove) => {
    if (cars.length > 1) {
      setCars(cars.filter(car => car.id !== idToRemove));
    }
  };

  // --- CHARGEMENT & SAUVEGARDE ---
  useEffect(() => {
    const loadInitialData = async () => {
      console.log(`🔄 Chargement des données pour le code: ${sharedCode}`);
      
      try {
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
          return;
        }
      } catch (error) {
        console.warn('⚠️ API non disponible, fallback localStorage:', error.message);
      }
      
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
      
    }, 2000);

    return () => clearTimeout(saveTimeout);
  }, [cars, dureeMois, kmAnnuel, parking, vignette, tauxCreditGlobal, inflationAnnuelle, tauxPlacement, sharedCode]);

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
    
    const healthInterval = setInterval(() => {
      checkHealth().then(setApiHealth);
    }, 30000);
    
    return () => clearInterval(healthInterval);
  }, []);

  useEffect(() => {
    setQueueSize(getQueueSize());
  }, [cars, sharedCode]);

  // --- FONCTIONS UTILITAIRES ---
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

  const updateSharedCode = (newCode) => {
    const cleanCode = newCode.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
    setSharedCode(cleanCode);
    localStorage.setItem('comparateur_shared_code', cleanCode);
    setIsCodeValid(true);
    setShowLoadButton(true);
  };

  const loadDataForCurrentCode = async () => {
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
        setShowLoadButton(false);
        
        alert(`✅ Données chargées depuis le serveur SQLite pour le code "${sharedCode}"`);
      } else {
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sharedCode);
  };

  const openImageModal = (url, title) => {
    if (url && url.trim() !== '') {
      setModalImage({
        isOpen: true,
        url,
        title
      });
    }
  };

  const closeImageModal = () => {
    setModalImage({
      isOpen: false,
      url: '',
      title: ''
    });
  };

  // Fonction utilitaire pour déterminer le label "Banque" selon le type de financement
  const getBanqueLabel = (type) => {
    switch(type) {
      case 'leasing': return 'Loyer';
      case 'credit': return 'Dépréciation + Intérêts';
      case 'comptant': return 'Dépréciation';
      default: return 'Banque';
    }
  };

  // --- JSX ---
  // Pour des raisons de concision, seul le JSX essentiel est inclus
  // Le JSX complet sera copié dans l'étape suivante
  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        {/* Layout Dashboard à deux colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Colonne GAUCHE (Édition) - 8/12 */}
          <div className="lg:col-span-8 space-y-6">
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
              
              {/* Slider pour la durée de détention */}
              <div className="mt-6 pt-4 border-t border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Durée de détention (pour Crédit/Comptant) : <span className="font-bold text-indigo-700">{dureeDetention} mois</span> ({Math.floor(dureeDetention/12)} ans)
                </label>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500 w-12">48 mois</span>
                  <input
                    type="range"
                    min="48"
                    max="120"
                    step="12"
                    value={dureeDetention}
                    onChange={(e) => setDureeDetention(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600"
                  />
                  <span className="text-xs text-slate-500 w-16">120 mois</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Cette durée s'applique au <strong>Crédit</strong> et au <strong>Comptant</strong> pour calculer la dépréciation long terme. Le <strong>Leasing</strong> utilise la durée fixe du contrat ({dureeMois} mois).
                </div>
              </div>
              
              <div className="mt-4 text-xs text-slate-500">
                <span className="font-medium">Coût d'opportunité :</span> Le taux de placement représente le rendement annuel que vous pourriez obtenir en investissant votre argent plutôt que de l'utiliser pour acheter un véhicule. Ce coût est inclus dans le TCO.
              </div>
            </div>

            {/* PILE DE CARTES VÉHICULES HORIZONTALES */}
            <div className="flex flex-col gap-4 pb-6">
              {cars.map((car, index) => (
                <div key={car.id} className="bg-white rounded-xl shadow-md border border-slate-200 flex flex-col relative group">
                  
                  {/* HEADER HORIZONTAL - Full Width */}
                  <div className="w-full bg-slate-900 text-white p-3 rounded-t-2xl flex justify-between items-center">
                    {/* Nom du véhicule à gauche */}
                    <input 
                      type="text" 
                      value={car.name} 
                      onChange={e => updateCar(index, 'name', e.target.value)}
                      className="bg-transparent text-white font-bold text-lg border-none focus:outline-none focus:ring-0 placeholder-slate-300 w-1/3"
                      placeholder={`Véhicule ${index + 1}`}
                    />
                    
                    {/* Sélecteur de motorisation au centre */}
                    <div className="flex items-center gap-2">
                      <select
                        value={car.motorisation}
                        onChange={e => updateCar(index, 'motorisation', e.target.value)}
                        className="bg-slate-800 text-white px-3 py-1.5 rounded-lg border border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="ICE">Thermique (ICE)</option>
                        <option value="PHEV">Hybride (PHEV)</option>
                        <option value="BEV">Électrique (BEV)</option>
                      </select>
                      
                      {/* Badge de motorisation */}
                      <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        car.motorisation === 'ICE' ? 'bg-orange-500 text-white' : 
                        car.motorisation === 'BEV' ? 'bg-blue-500 text-white' : 
                        'bg-emerald-500 text-white'
                      }`}>
                        {car.motorisation === 'ICE' ? 'Thermique' : 
                         car.motorisation === 'BEV' ? 'Électrique' : 
                         'Hybride PHEV'}
                      </div>
                    </div>
                    
                    {/* Bouton supprimer à droite */}
                    <button 
                      onClick={() => removeCar(car.id)}
                      disabled={cars.length === 1}
                      className="text-slate-300 hover:text-red-400 disabled:opacity-30 transition-colors"
                      title="Supprimer ce véhicule"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* CORPS DE LA CARTE - 3 COLONNES */}
                  <div className="flex flex-row">
                    
                    {/* ZONE A - Identité & Usage (18%) */}
                    <div className="w-[18%] p-4 bg-slate-50 border-r border-slate-200">
                      {/* Photo & URL */}
                      <div className="mb-4">
                        {car.photoUrl ? (
                          <img 
                            src={car.photoUrl} 
                            className="w-full aspect-video object-cover rounded-lg mb-2 shadow-sm border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity" 
                            onClick={() => openImageModal(car.photoUrl, car.name)} 
                            alt={car.name}
                          />
                        ) : (
                          <div className="w-full aspect-video bg-slate-100 rounded-lg mb-2 flex items-center justify-center text-slate-400 text-xs border border-slate-300 border-dashed">
                            Aucune photo
                          </div>
                        )}
                        <input
                          type="text"
                          value={car.photoUrl}
                          onChange={e => updateCar(index, 'photoUrl', e.target.value)}
                          placeholder="Coller l'URL de l'image..."
                          className="w-full p-1.5 text-[10px] border border-slate-300 rounded bg-white text-slate-600 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-shadow"
                        />
                      </div>
                      
                      {/* Prix TTC */}
                      <div className="text-center mb-4">
                        <div className="text-[10px] text-slate-400 uppercase font-bold text-center">Prix TTC</div>
                        <div className="font-black text-slate-900 text-2xl text-center">{car.prixAchat.toFixed(0)} CHF</div>
                      </div>
                      
                      {/* Forfait Usage */}
                      <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                        <div className="text-xs font-bold text-indigo-600 uppercase mb-2">Forfait Usage (moyenne mensuelle)</div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-600">Énergie</span>
                            <span className="font-bold text-slate-800">{results[index].coutEnergieMensuel.toFixed(0)} CHF</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-600">Frais fixes</span>
                            <span className="font-bold text-slate-800">{(results[index].fraisUsage - results[index].coutEnergieMensuel).toFixed(0)} CHF</span>
                          </div>
                          <div className="pt-2 border-t border-indigo-100">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-slate-900">Total Usage</span>
                              <span className="text-lg font-bold text-slate-900">{results[index].fraisUsage.toFixed(0)} CHF</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ZONE B - Saisie (42%) */}
                    <div className="w-[42%] p-4 bg-slate-50 border-r border-slate-200">
                      <div className="space-y-3">
                        {/* Bloc Acquisition */}
                        <div className="bg-white rounded-xl border border-slate-200 p-3">
                          <div className="text-xs font-bold text-slate-500 mb-2">Acquisition</div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase">Prix TTC</label>
                              <NumericInput
                                value={car.prixAchat}
                                onChange={val => updateCar(index, 'prixAchat', val)}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 hover:bg-white focus:bg-white font-bold text-slate-900 transition-colors"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase">Résiduelle L.</label>
                              <NumericInput
                                value={car.valeurResiduelle}
                                onChange={val => updateCar(index, 'valeurResiduelle', val)}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 hover:bg-white focus:bg-white transition-colors"
                                placeholder="0.00"
                              />
                              <div className="text-center mt-1">
                                <span className="text-xs text-slate-500 font-medium">
                                  {car.prixAchat > 0 ? ((car.valeurResiduelle / car.prixAchat) * 100).toFixed(1) : '0.0'}%
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col justify-end">
                              <div className="flex items-center gap-1 mb-[2px]">
                                <label className="block text-[9px] font-bold text-slate-400 uppercase">Résiduelle C/C</label>
                                <Tooltip
                                  content="Valeur résiduelle calculée pour Crédit/Comptant (dépréciation long terme + risque Lausanne 2030)"
                                  position="top"
                                >
                                  <Info className="w-3 h-3 text-slate-400 cursor-help" />
                                </Tooltip>
                              </div>
                              <div className="w-full px-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 flex items-center h-[38px]">
                                {results[index].valeurResiduelleReelle?.toFixed(0) || '0'} CHF
                              </div>
                              <div className="text-center mt-1">
                                <span className="text-xs text-slate-500 font-medium">
                                  {car.prixAchat > 0 ? ((results[index].valeurResiduelleReelle / car.prixAchat) * 100).toFixed(1) : '0.0'}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bloc Financement */}
                        <div className="bg-white rounded-xl border border-slate-200 p-3">
                          <div className="text-xs font-bold text-slate-500 mb-2">Financement</div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase">Apport L.</label>
                              <NumericInput
                                value={car.apport}
                                onChange={val => updateCar(index, 'apport', val)}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 hover:bg-white focus:bg-white transition-colors"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase">Apport C.</label>
                              <NumericInput
                                value={car.apportCredit}
                                onChange={val => updateCar(index, 'apportCredit', val)}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 hover:bg-white focus:bg-white transition-colors"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase">Taux L. (%)</label>
                              <NumericInput
                                value={car.tauxLeasing}
                                onChange={val => updateCar(index, 'tauxLeasing', val)}
                                className="w-full p-2 border border-blue-200 rounded-lg text-sm bg-slate-50 hover:bg-white focus:bg-white font-bold transition-colors"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Bloc Usage & Risque */}
                        <div className="bg-white rounded-xl border border-slate-200 p-3">
                          <div className="text-xs font-bold text-slate-500 mb-2">Usage & Risque</div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-amber-600 uppercase">Risque (%)</label>
                              <NumericInput
                                value={car.risqueDepreciation}
                                onChange={val => updateCar(index, 'risqueDepreciation', val)}
                                className="w-full p-2 border border-amber-300 rounded-lg text-sm bg-amber-50 hover:bg-white focus:bg-white transition-colors"
                                placeholder="0-30"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase">Conso É. (kWh)</label>
                              <NumericInput
                                value={car.consoElec}
                                onChange={val => updateCar(index, 'consoElec', val)}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 hover:bg-white focus:bg-white transition-colors"
                                placeholder="0.0"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase">Conso Ess. (L)</label>
                              <NumericInput
                                value={car.consoEssence}
                                onChange={val => updateCar(index, 'consoEssence', val)}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 hover:bg-white focus:bg-white transition-colors"
                                placeholder="0.0"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase">Assurance</label>
                              <NumericInput
                                value={car.assurance}
                                onChange={val => updateCar(index, 'assurance', val)}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 hover:bg-white focus:bg-white transition-colors"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase">Impôt</label>
                              <NumericInput
                                value={car.impotCantonal}
                                onChange={val => updateCar(index, 'impotCantonal', val)}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 hover:bg-white focus:bg-white transition-colors"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase">Entretien</label>
                              <NumericInput
                                value={car.entretien}
                                onChange={val => updateCar(index, 'entretien', val)}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 hover:bg-white focus:bg-white transition-colors"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* NOUVEAU : Bloc Notes & Commentaire */}
                        <div className="bg-white rounded-xl border border-slate-200 p-3 mt-3">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                            Notes & Lien de l'annonce
                          </label>
                          <textarea
                            value={car.commentaire}
                            onChange={e => updateCar(index, 'commentaire', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 hover:bg-white focus:bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all resize-none h-14"
                            placeholder="Lien vers l'annonce, options incluses, remarques particulières..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* ZONE C - Résultats & Notes (40%) */}
                    <div className="w-2/5 p-4">
                      {/* Graphiques StackedBarChart */}
                      <div className="space-y-3 mb-4">
                        <StackedBarChart
                          breakdown={results[index].leasing.breakdown}
                          type="leasing"
                          vehicleName={car.name}
                          motorisation={car.motorisation}
                          maxValue={maxTCO}
                        />
                        <Tooltip
                          content="Argent qui sort physiquement de votre compte courant chaque mois (Mensualité réelle + Énergie + Frais fixes). Ne tient pas compte de la perte de valeur du véhicule ni de l'apport initial."
                          position="top"
                        >
                          <div className="mt-1 space-y-1">
                            <div className="bg-slate-100 px-3 py-2 rounded-lg flex items-center gap-2 text-sm text-slate-700">
                              <Wallet className="w-4 h-4 text-blue-500" />
                              <span>Sortie trésorerie :</span>
                              <span className="font-semibold text-slate-900 ml-auto">
                                {results[index].leasing.tresorerieMensuelle.toFixed(0)} CHF / mois
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 ml-4 flex items-center gap-2">
                              <span>Échéance Loyer :</span>
                              <span className="font-semibold">
                                {results[index].leasing.mensualiteBrute.toFixed(0)} CHF / mois
                              </span>
                            </div>
                          </div>
                        </Tooltip>
                        <StackedBarChart 
                          breakdown={results[index].credit.breakdown}
                          type="credit"
                          vehicleName={car.name}
                          motorisation={car.motorisation}
                          maxValue={maxTCO}
                        />
                        <Tooltip
                          content="Argent qui sort physiquement de votre compte courant chaque mois (Mensualité réelle + Énergie + Frais fixes). Ne tient pas compte de la perte de valeur du véhicule ni de l'apport initial."
                          position="top"
                        >
                          <div className="mt-1 space-y-1">
                            <div className="bg-slate-100 px-3 py-2 rounded-lg flex items-center gap-2 text-sm text-slate-700">
                              <Wallet className="w-4 h-4 text-emerald-500" />
                              <span>Sortie trésorerie :</span>
                              <span className="font-semibold text-slate-900 ml-auto">
                                {results[index].credit.tresorerieMensuelle.toFixed(0)} CHF / mois
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 ml-4 flex items-center gap-2">
                              <span>Échéance Crédit :</span>
                              <span className="font-semibold">
                                {results[index].credit.mensualiteBrute.toFixed(0)} CHF / mois
                              </span>
                            </div>
                          </div>
                        </Tooltip>
                        <StackedBarChart 
                          breakdown={results[index].comptant.breakdown}
                          type="comptant"
                          vehicleName={car.name}
                          motorisation={car.motorisation}
                          maxValue={maxTCO}
                        />
                        <Tooltip
                          content="Argent qui sort physiquement de votre compte courant chaque mois (Mensualité réelle + Énergie + Frais fixes). Ne tient pas compte de la perte de valeur du véhicule ni de l'apport initial."
                          position="top"
                        >
                          <div className="bg-slate-100 px-3 py-2 rounded-lg flex items-center gap-2 text-sm text-slate-700 mt-1">
                            <Wallet className="w-4 h-4 text-purple-500" />
                            <span>Sortie trésorerie :</span>
                            <span className="font-semibold text-slate-900 ml-auto">
                              {results[index].comptant.tresorerieMensuelle.toFixed(0)} CHF / mois
                            </span>
                          </div>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* BOUTON AJOUTER */}
              <div className="flex justify-center mt-4">
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

          {/* Colonne DROITE (Résultat) - 4/12 - Panneau de classement persistant */}
          <div className="lg:col-span-4 sticky top-6 space-y-4">
            
            {/* Bloc Comparaison des Coûts Mensuels */}
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 shadow-slate-800/10 border-t-4 border-t-indigo-600">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                  <BarChart3 className="w-6 h-6 text-indigo-500" />
                  Comparaison des Coûts Mensuels (Synthèse)
                </h2>
                
                {/* Filtres */}
                <div className="flex gap-1">
                  {['all', 'leasing', 'credit', 'comptant'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setFilterMode(mode)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                        filterMode === mode 
                          ? mode === 'leasing' ? 'bg-blue-600 text-white' 
                            : mode === 'credit' ? 'bg-emerald-600 text-white' 
                            : mode === 'comptant' ? 'bg-purple-600 text-white' 
                            : 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {mode === 'all' ? 'Tous' : mode === 'leasing' ? 'Leasing' : mode === 'credit' ? 'Crédit' : 'Comptant'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {(() => {
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

                  // Filtrer selon le mode sélectionné
                  const filteredData = filterMode === 'all'
                    ? allData
                    : allData.filter(item => item.type === filterMode);

                  filteredData.sort((a, b) => a.total - b.total);
                  const maxValue = Math.max(...filteredData.map(d => d.breakdown.total), 1) * 1.05;

                  const colorSchemes = {
                    blue: {
                      apportLisse: 'bg-blue-950',
                      banque: 'bg-blue-700',
                      energie: 'bg-blue-500',
                      fraisFixes: 'bg-blue-300',
                      opportunite: 'bg-blue-200'
                    },
                    emerald: {
                      apportLisse: 'bg-emerald-950',
                      banque: 'bg-emerald-700',
                      energie: 'bg-emerald-500',
                      fraisFixes: 'bg-emerald-300',
                      opportunite: 'bg-emerald-200'
                    },
                    purple: {
                      apportLisse: 'bg-purple-950',
                      banque: 'bg-purple-700',
                      energie: 'bg-purple-500',
                      fraisFixes: 'bg-purple-300',
                      opportunite: 'bg-purple-200'
                    }
                  };

                  return filteredData.map((item, index) => {
                    const colors = colorSchemes[item.color];
                    const typeLabel = item.type === 'leasing' ? 'Leasing' : item.type === 'credit' ? 'Crédit' : 'Comptant';

                    return (
                      <div key={`ranking-${index}`} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 ${item.type === 'leasing' ? 'bg-blue-500' : item.type === 'credit' ? 'bg-emerald-500' : 'bg-purple-500'} rounded`}></div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 text-sm">{item.vehicle}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full w-fit mt-1 ${
                                item.type === 'leasing' ? 'bg-blue-100 text-blue-700' 
                                : item.type === 'credit' ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-purple-100 text-purple-700'
                              }`}>
                                {typeLabel}
                              </span>
                            </div>
                          </div>
                          <span className={`font-bold ${item.type === 'leasing' ? 'text-blue-700' : item.type === 'credit' ? 'text-emerald-700' : 'text-purple-700'} text-sm`}>
                            {item.total.toFixed(0)} CHF
                          </span>
                        </div>
                        
                        {/* Barre empilée */}
                        <div className="w-full h-4 bg-slate-100 rounded-full overflow-visible flex relative z-30">
                          {Object.keys(item.breakdown).filter(key => key !== 'total').map((key, catIndex) => {
                            const value = item.breakdown[key];
                            const widthPercentage = (value / maxValue) * 100;
                            
                            if (value <= 0) return null;
                            
                            let bgColor = '';
                            switch(key) {
                              case 'apportLisse': bgColor = colors.apportLisse; break;
                              case 'banque': bgColor = colors.banque; break;
                              case 'energie': bgColor = colors.energie; break;
                              case 'fraisFixes': bgColor = colors.fraisFixes; break;
                              case 'opportunite': bgColor = colors.opportunite; break;
                              default: bgColor = 'bg-slate-400';
                            }
                            
                            return (
                              <Tooltip
                                key={`${index}-${key}`}
                                content={`${key === 'apportLisse' ? 'Apport Lissé' :
                                          key === 'banque' ? getBanqueLabel(item.type) :
                                          key === 'energie' ? 'Énergie' :
                                          key === 'fraisFixes' ? 'Frais Fixes' : 'Opportunité'}: ${value.toFixed(0)} CHF`}
                                position="top"
                                width={`${widthPercentage}%`}
                              >
                                <div
                                  className={`h-full w-full ${bgColor} transition-all duration-300 hover:opacity-90`}
                                />
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Légende des segments */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-slate-700 mb-4">Légende des segments</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-slate-900 rounded"></div>
                    <span className="text-sm text-slate-700">Apport Lissé</span>
                  </div>
                  <span className="text-xs text-slate-500">Coût net de l'apport</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-slate-700 rounded"></div>
                    <span className="text-sm text-slate-700">Financement/Dépréciation</span>
                  </div>
                  <span className="text-xs text-slate-500">Loyer (Leasing), Dépréciation+Intérêts (Crédit), Dépréciation (Comptant)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-slate-600 rounded"></div>
                    <span className="text-sm text-slate-700">Énergie</span>
                  </div>
                  <span className="text-xs text-slate-500">Carburant/Électricité</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-slate-400 rounded"></div>
                    <span className="text-sm text-slate-700">Frais Fixes</span>
                  </div>
                  <span className="text-xs text-slate-500">Assurance + Entretien</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-slate-200 rounded"></div>
                    <span className="text-sm text-slate-700">Opportunité</span>
                  </div>
                  <span className="text-xs text-slate-500">Gain manqué placement</span>
                </div>
              </div>
            </div>

            {/* Résumé statistique */}
            {results.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-700 mb-4">Résumé par Mode</h3>
                <div className="space-y-4">
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
              </div>
            )}
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