import React, { useState, useEffect } from 'react';
import { Calculator, Car, Save, Cloud, CheckCircle, Wallet, Plus, Trash2, BarChart3, AlertCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- Configuration Firebase (Compatible Canvas & Netlify/Vite/CRA) ---
let firebaseConfig = {};

if (typeof __firebase_config !== 'undefined') {
  // Environnement Canvas (Automatique)
  firebaseConfig = JSON.parse(__firebase_config);
} else if (typeof import.meta !== 'undefined' && import.meta.env) {
  // Environnement Vite (Netlify, Vercel, etc.)
  firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
}

// Vérifie si Firebase est bien configuré (évite les crashs sur Netlify si on oublie les clés)
const isFirebaseValid = firebaseConfig && firebaseConfig.apiKey;
const app = isFirebaseValid ? initializeApp(firebaseConfig) : null;
const auth = isFirebaseValid ? getAuth(app) : null;
const db = isFirebaseValid ? getFirestore(app) : null;
const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'comparateur-auto-perso';

// Fonction utilitaire pour convertir les nombres avec séparateurs décimaux
const parseDecimal = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  
  // Remplacer les virgules par des points
  const normalized = value.replace(',', '.');
  
  // Supprimer tout ce qui n'est pas chiffre, point ou signe négatif
  const cleaned = normalized.replace(/[^\d.-]/g, '');
  
  // Convertir en nombre
  const num = parseFloat(cleaned);
  
  // Retourner 0 si NaN, sinon le nombre
  return isNaN(num) ? 0 : num;
};

// Fonction pour formater l'affichage avec le séparateur approprié
const formatDecimal = (value, decimals = 2) => {
  const num = typeof value === 'number' ? value : parseDecimal(value);
  return num.toFixed(decimals).replace('.', ',');
};

const App = () => {
  // --- ÉTAT AUTH & SAUVEGARDE ---
  const [user, setUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(false);

  // --- PARAMÈTRES GLOBAUX ---
  const [dureeMois, setDureeMois] = useState(48);
  const [kmAnnuel, setKmAnnuel] = useState(15000);
  const [parking, setParking] = useState(0); 
  const [vignette, setVignette] = useState(40); 
  const [tauxCreditGlobal, setTauxCreditGlobal] = useState(4.9);
  const [inflationAnnuelle, setInflationAnnuelle] = useState(2.0);
  const [tauxPlacement, setTauxPlacement] = useState(3.0);

  // --- VÉHICULES (Tableau d'objets dynamique) ---
  const [cars, setCars] = useState([]);
  
  // Données par défaut si Firebase n'est pas configuré ou si aucune donnée n'existe
  const defaultCars = [
    {
      id: 1,
      name: "Votre Devis Actuel",
      prixAchat: 52037,
      apport: 15000,
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
      prixAchat: 46000,
      apport: 10000,
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
      prixAchat: 56000,
      apport: 15000,
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
    const numericFields = ['prixAchat', 'apport', 'tauxLeasing', 'valeurResiduelle', 
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

  // --- EFFETS FIREBASE ---
  useEffect(() => {
    if (!auth) return; // Ignore si on est sur Netlify sans configuration Firebase
    
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Erreur d'authentification :", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const userDocRef = doc(db, 'artifacts', currentAppId, 'users', user.uid, 'simulations', 'my_comparison');

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.cars) setCars(data.cars);
        if (data.dureeMois) setDureeMois(data.dureeMois);
        if (data.kmAnnuel) setKmAnnuel(data.kmAnnuel);
        if (data.parking !== undefined) setParking(data.parking);
        if (data.vignette !== undefined) setVignette(data.vignette);
        if (data.tauxCreditGlobal !== undefined) setTauxCreditGlobal(data.tauxCreditGlobal);
        if (data.updatedAt) setLastSaved(new Date(data.updatedAt));
      } else {
        // Si le document n'existe pas, utiliser les données par défaut
        setCars(defaultCars);
      }
    }, (error) => {
       console.error("Erreur de synchronisation :", error);
       // En cas d'erreur, utiliser les données par défaut
       setCars(defaultCars);
    });

    return () => unsubscribe();
  }, [user]);

  // Utiliser les données par défaut si Firebase n'est pas configuré
  useEffect(() => {
    if (!isFirebaseValid && cars.length === 0) {
      setCars(defaultCars);
    }
  }, [isFirebaseValid]);

  const saveData = async () => {
    if (!isFirebaseValid) {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 4000);
      return;
    }
    if (!user || !db) return;
    
    setIsSaving(true);
    try {
      const userDocRef = doc(db, 'artifacts', currentAppId, 'users', user.uid, 'simulations', 'my_comparison');
      await setDoc(userDocRef, {
        cars,
        dureeMois,
        kmAnnuel,
        parking,
        vignette,
        tauxCreditGlobal,
        updatedAt: new Date().toISOString()
      });
      setLastSaved(new Date());
    } catch (error) {
      console.error("Erreur de sauvegarde :", error);
    }
    setIsSaving(false);
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

      // 2. CRÉDIT
      const rCredit = (tauxCreditGlobal / 100) / 12;
      let pmtCredit = 0;
      if (rCredit > 0) {
        pmtCredit = capitalFinance * (rCredit / (1 - Math.pow(1 + rCredit, -dureeMois)));
      } else {
        pmtCredit = capitalFinance / dureeMois;
      }
      const coutVehiculeLisseCredit = (car.apport + (pmtCredit * dureeMois) - car.valeurResiduelle) / dureeMois;

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
          </div>
          
          <div className="flex flex-col items-end">
            <button 
              onClick={saveData}
              disabled={isSaving || (isFirebaseValid && !user)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? <Cloud className="w-5 h-5 animate-pulse" /> : <Save className="w-5 h-5" />}
              {isSaving ? "Sauvegarde..." : "Sauvegarder dans le cloud"}
            </button>
            {lastSaved && !saveError && (
              <p className="text-sm text-slate-500 mt-2 flex items-center gap-1.5 font-medium">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> 
                Dernière sauvegarde : {lastSaved.toLocaleTimeString('fr-CH', {hour: '2-digit', minute:'2-digit'})}
              </p>
            )}
            {saveError && (
              <p className="text-sm text-red-500 mt-2 flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-4 h-4" /> 
                Hébergement externe : Configurez Firebase
              </p>
            )}
          </div>
        </header>

        {/* SYNTHÈSE GRAPHIQUE AMÉLIORÉE */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-800">
            <BarChart3 className="w-6 h-6 text-indigo-500" /> 
            Comparaison Visuelle des Véhicules (TCO Mensuel)
          </h2>
          
          {/* Sélecteur de mode de financement */}
          <div className="flex space-x-2 mb-6">
            <button className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-medium text-sm">Leasing</button>
            <button className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-lg font-medium text-sm">Crédit ({tauxCreditGlobal}%)</button>
            <button className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg font-medium text-sm">Comptant</button>
          </div>

          {/* Graphique de comparaison */}
          <div className="space-y-4">
            {results.map((r, index) => {
              const tcoLeasing = r.leasing.tco;
              const tcoCredit = r.credit.tco;
              const tcoComptant = r.comptant.tco;
              const maxVehicleTCO = Math.max(tcoLeasing, tcoCredit, tcoComptant);
              
              return (
                <div key={`comparison-${r.id}`} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">{r.name}</span>
                    <div className="flex space-x-4 text-sm">
                      <span className="text-blue-600 font-medium">{tcoLeasing.toFixed(0)} CHF</span>
                      <span className="text-emerald-600 font-medium">{tcoCredit.toFixed(0)} CHF</span>
                      <span className="text-purple-600 font-medium">{tcoComptant.toFixed(0)} CHF</span>
                    </div>
                  </div>
                  
                  {/* Barres comparatives */}
                  <div className="flex space-x-1 h-8">
                    {/* Barre Leasing */}
                    <div 
                      className="bg-blue-500 rounded-l-lg transition-all duration-500 hover:bg-blue-600 relative group"
                      style={{ width: `${(tcoLeasing / maxTCO) * 100}%` }}
                      title={`Leasing: ${tcoLeasing.toFixed(0)} CHF`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold">{tcoLeasing.toFixed(0)}</span>
                      </div>
                    </div>
                    
                    {/* Barre Crédit */}
                    <div 
                      className="bg-emerald-500 transition-all duration-500 hover:bg-emerald-600 relative group"
                      style={{ width: `${(tcoCredit / maxTCO) * 100}%` }}
                      title={`Crédit: ${tcoCredit.toFixed(0)} CHF`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold">{tcoCredit.toFixed(0)}</span>
                      </div>
                    </div>
                    
                    {/* Barre Comptant */}
                    <div 
                      className="bg-purple-500 rounded-r-lg transition-all duration-500 hover:bg-purple-600 relative group"
                      style={{ width: `${(tcoComptant / maxTCO) * 100}%` }}
                      title={`Comptant: ${tcoComptant.toFixed(0)} CHF`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold">{tcoComptant.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Légende détaillée */}
                  <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 mt-1">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-3 h-3 bg-blue-500 rounded"></div>
                        <span>Leasing</span>
                      </div>
                      <div className="font-bold text-slate-700">{tcoLeasing.toFixed(0)} CHF</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                        <span>Crédit</span>
                      </div>
                      <div className="font-bold text-slate-700">{tcoCredit.toFixed(0)} CHF</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-3 h-3 bg-purple-500 rounded"></div>
                        <span>Comptant</span>
                      </div>
                      <div className="font-bold text-slate-700">{tcoComptant.toFixed(0)} CHF</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Résumé statistique */}
          {results.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <h3 className="font-bold text-slate-700 mb-3">Résumé des coûts</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-blue-800 font-bold text-lg">Leasing</div>
                  <div className="text-2xl font-black text-blue-700 mt-1">
                    {(results.reduce((sum, r) => sum + r.leasing.tco, 0) / results.length).toFixed(0)} CHF
                  </div>
                  <div className="text-sm text-blue-600 mt-1">Moyenne par véhicule</div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg">
                  <div className="text-emerald-800 font-bold text-lg">Crédit</div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">
                    {(results.reduce((sum, r) => sum + r.credit.tco, 0) / results.length).toFixed(0)} CHF
                  </div>
                  <div className="text-sm text-emerald-600 mt-1">Moyenne par véhicule</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-purple-800 font-bold text-lg">Comptant</div>
                  <div className="text-2xl font-black text-purple-700 mt-1">
                    {(results.reduce((sum, r) => sum + r.comptant.tco, 0) / results.length).toFixed(0)} CHF
                  </div>
                  <div className="text-sm text-purple-600 mt-1">Moyenne par véhicule</div>
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
             <div className="col-span-1">
               <label className="block text-xs font-medium text-slate-500">Durée (mois)</label>
               <input type="text" value={dureeMois} onChange={e => setDureeMois(parseDecimal(e.target.value))} className="w-full p-2 border rounded-md" />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-slate-500">Km annuel</label>
               <input type="text" value={kmAnnuel} onChange={e => setKmAnnuel(parseDecimal(e.target.value))} className="w-full p-2 border rounded-md" />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-slate-500">Parking /mois</label>
               <input type="text" value={parking} onChange={e => setParking(parseDecimal(e.target.value))} className="w-full p-2 border rounded-md" />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-slate-500">Vignette /an</label>
               <input type="text" value={vignette} onChange={e => setVignette(parseDecimal(e.target.value))} className="w-full p-2 border rounded-md" />
             </div>
             <div className="col-span-1 border-l border-slate-200 pl-4">
               <label className="block text-xs font-bold text-emerald-600">Crédit (%)</label>
               <input type="text" value={formatDecimal(tauxCreditGlobal, 2)} onChange={e => setTauxCreditGlobal(parseDecimal(e.target.value))} className="w-full p-2 border border-emerald-300 rounded-md bg-emerald-50 text-emerald-900 font-bold" />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-amber-600">Inflation (%)</label>
               <input type="text" value={formatDecimal(inflationAnnuelle, 2)} onChange={e => setInflationAnnuelle(parseDecimal(e.target.value))} className="w-full p-2 border border-amber-300 rounded-md bg-amber-50 text-amber-900" />
             </div>
             <div className="col-span-1">
               <label className="block text-xs font-medium text-cyan-600">Placement (%)</label>
               <input type="text" value={formatDecimal(tauxPlacement, 2)} onChange={e => setTauxPlacement(parseDecimal(e.target.value))} className="w-full p-2 border border-cyan-300 rounded-md bg-cyan-50 text-cyan-900" />
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

              {/* Badge % valeur résiduelle */}
              {car.prixAchat > 0 && (
                <div className="absolute top-4 right-4 bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-full z-10">
                  {((car.valeurResiduelle / car.prixAchat) * 100).toFixed(1)}% résiduel
                </div>
              )}

              {/* Contenu en 2 colonnes : Formulaire + Résultats */}
              <div className="flex flex-col lg:flex-row flex-grow">
                {/* Colonne GAUCHE : Formulaire */}
                <div className="lg:w-1/2 p-4 space-y-3 border-r border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase">Prix TTC (CHF)</label>
                    <input type="text" value={car.prixAchat} onChange={e => updateCar(index, 'prixAchat', e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-slate-50" />
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg space-y-2">
                    <span className="text-xs font-bold text-blue-800 uppercase">Conditions leasing</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-blue-700">Apport</label>
                        <input type="text" value={car.apport} onChange={e => updateCar(index, 'apport', e.target.value)} className="w-full p-1.5 border border-blue-200 rounded text-sm bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-700">Taux (%)</label>
                        <input type="text" value={formatDecimal(car.tauxLeasing, 2)} onChange={e => updateCar(index, 'tauxLeasing', e.target.value)} className="w-full p-1.5 border border-blue-200 rounded text-sm bg-white font-bold" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase">Valeur Résiduelle (CHF)</label>
                    <input type="text" value={car.valeurResiduelle} onChange={e => updateCar(index, 'valeurResiduelle', e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Assurance</label>
                      <input type="text" value={car.assurance} onChange={e => updateCar(index, 'assurance', e.target.value)} className="w-full p-1.5 border border-slate-200 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Impôt</label>
                      <input type="text" value={car.impotCantonal} onChange={e => updateCar(index, 'impotCantonal', e.target.value)} className="w-full p-1.5 border border-slate-200 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Entretien</label>
                      <input type="text" value={car.entretien} onChange={e => updateCar(index, 'entretien', e.target.value)} className="w-full p-1.5 border border-slate-200 rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Conso</label>
                      <input type="text" value={formatDecimal(car.consommation, 1)} onChange={e => updateCar(index, 'consommation', e.target.value)} className="w-full p-1.5 border border-slate-200 rounded text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Prix carburant/énergie (CHF)</label>
                    <input type="text" value={formatDecimal(car.prixCarburant, 2)} onChange={e => updateCar(index, 'prixCarburant', e.target.value)} className="w-full p-1.5 border border-slate-200 rounded text-sm" />
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
    </div>
  );
};

export default App;
