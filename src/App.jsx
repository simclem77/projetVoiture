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
    newCars[index][field] = value;
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

        {/* RÉCAPITULATIF GRAPHIQUE */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
           <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-800">
             <BarChart3 className="w-6 h-6 text-indigo-500" /> 
             Récapitulatif Graphique (Coût Mensuel Vrai TCO)
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             {results.map(r => (
               <div key={`chart-${r.id}`} className="space-y-3">
                 <h3 className="font-bold text-slate-700 truncate border-b pb-2">{r.name}</h3>
                 
                 <div className="space-y-3">
                   {/* Barre Leasing */}
                   <div>
                     <div className="flex justify-between text-xs mb-1 font-medium">
                       <span className="text-blue-700">Leasing</span>
                       <span className="text-slate-600">{r.leasing.tco.toFixed(0)} CHF</span>
                     </div>
                     <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                       <div className="bg-blue-500 h-4 rounded-full transition-all duration-500" style={{ width: `${(r.leasing.tco / maxTCO) * 100}%` }}></div>
                     </div>
                   </div>
                   {/* Barre Crédit */}
                   <div>
                     <div className="flex justify-between text-xs mb-1 font-medium">
                       <span className="text-emerald-700">Crédit ({tauxCreditGlobal}%)</span>
                       <span className="text-slate-600">{r.credit.tco.toFixed(0)} CHF</span>
                     </div>
                     <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                       <div className="bg-emerald-500 h-4 rounded-full transition-all duration-500" style={{ width: `${(r.credit.tco / maxTCO) * 100}%` }}></div>
                     </div>
                   </div>
                   {/* Barre Comptant */}
                   <div>
                     <div className="flex justify-between text-xs mb-1 font-medium">
                       <span className="text-purple-700">Comptant</span>
                       <span className="text-slate-600">{r.comptant.tco.toFixed(0)} CHF</span>
                     </div>
                     <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                       <div className="bg-purple-500 h-4 rounded-full transition-all duration-500" style={{ width: `${(r.comptant.tco / maxTCO) * 100}%` }}></div>
                     </div>
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </div>

        {/* PARAMÈTRES GLOBAUX */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-indigo-800">
            <Wallet className="w-5 h-5" /> Paramètres d'Usage & Crédit
          </h2>
          <div className="flex flex-wrap gap-4">
             <div className="flex-1 min-w-[150px]">
               <label className="block text-xs font-medium text-slate-500">Durée (mois)</label>
               <input type="number" value={dureeMois} onChange={e => setDureeMois(Number(e.target.value))} className="w-full p-2 border rounded-md" />
             </div>
             <div className="flex-1 min-w-[150px]">
               <label className="block text-xs font-medium text-slate-500">Km annuel</label>
               <input type="number" value={kmAnnuel} onChange={e => setKmAnnuel(Number(e.target.value))} className="w-full p-2 border rounded-md" />
             </div>
             <div className="flex-1 min-w-[150px]">
               <label className="block text-xs font-medium text-slate-500">Parking / mois (CHF)</label>
               <input type="number" value={parking} onChange={e => setParking(Number(e.target.value))} className="w-full p-2 border rounded-md" />
             </div>
             <div className="flex-1 min-w-[200px] border-l border-slate-200 pl-4">
               <label className="block text-xs font-bold text-emerald-600">Taux Crédit Auto Privé (%)</label>
               <input type="number" step="0.01" value={tauxCreditGlobal} onChange={e => setTauxCreditGlobal(Number(e.target.value))} className="w-full p-2 border border-emerald-300 rounded-md bg-emerald-50 text-emerald-900 font-bold" />
             </div>
          </div>
        </div>

        {/* GRILLE HORIZONTALE DES VÉHICULES */}
        <div className="flex overflow-x-auto gap-6 pb-6 pt-2 snap-x">
          {cars.map((car, index) => (
            <div key={car.id} className="min-w-[340px] max-w-[360px] shrink-0 snap-center bg-white rounded-xl shadow-md border border-slate-200 flex flex-col relative group">
              
              {/* Entête Véhicule */}
              <div className="bg-slate-800 p-4 rounded-t-xl flex justify-between items-center">
                <input 
                  type="text" 
                  value={car.name} 
                  onChange={e => updateCar(index, 'name', e.target.value)}
                  className="w-full bg-slate-700 text-white font-bold text-lg p-2 rounded border-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 mr-2"
                  placeholder={`Véhicule ${index + 1}`}
                />
                <button 
                  onClick={() => removeCar(car.id)}
                  disabled={cars.length === 1}
                  className="text-slate-400 hover:text-red-400 disabled:opacity-30 transition-colors"
                  title="Supprimer ce véhicule"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Formulaire Véhicule */}
              <div className="p-4 space-y-4 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Prix Brut TTC (CHF)</label>
                    <input type="number" value={car.prixAchat} onChange={e => updateCar(index, 'prixAchat', Number(e.target.value))} className="w-full p-2 border border-slate-300 rounded-lg font-bold text-lg text-slate-800 bg-slate-50" />
                  </div>
                  
                  {/* Spécifique Leasing */}
                  <div className="col-span-2 bg-blue-50 border border-blue-100 p-3 rounded-lg grid grid-cols-2 gap-3">
                     <div className="col-span-2 mb-[-8px]">
                       <span className="text-xs font-bold text-blue-800 uppercase">Conditions du vendeur</span>
                     </div>
                     <div>
                       <label className="block text-xs font-semibold text-blue-700">Apport initial</label>
                       <input type="number" value={car.apport} onChange={e => updateCar(index, 'apport', Number(e.target.value))} className="w-full p-1.5 border border-blue-200 rounded text-sm bg-white" />
                     </div>
                     <div>
                       <label className="block text-xs font-semibold text-blue-700">Taux Leasing (%)</label>
                       <input type="number" step="0.01" value={car.tauxLeasing} onChange={e => updateCar(index, 'tauxLeasing', Number(e.target.value))} className="w-full p-1.5 border border-blue-200 rounded text-sm bg-white font-bold" />
                     </div>
                  </div>

                  <div className="col-span-2 mt-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase flex justify-between">
                      Valeur Résiduelle
                      {car.prixAchat > 0 && <span className="text-indigo-600 font-bold">{((car.valeurResiduelle / car.prixAchat) * 100).toFixed(1)}%</span>}
                    </label>
                    <input type="number" value={car.valeurResiduelle} onChange={e => updateCar(index, 'valeurResiduelle', Number(e.target.value))} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Assurance /an</label>
                    <input type="number" value={car.assurance} onChange={e => updateCar(index, 'assurance', Number(e.target.value))} className="w-full p-1.5 border border-slate-200 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Impôt /an</label>
                    <input type="number" value={car.impotCantonal} onChange={e => updateCar(index, 'impotCantonal', Number(e.target.value))} className="w-full p-1.5 border border-slate-200 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Entretien /an</label>
                    <input type="number" value={car.entretien} onChange={e => updateCar(index, 'entretien', Number(e.target.value))} className="w-full p-1.5 border border-slate-200 rounded text-sm" />
                  </div>
                  <div></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Conso /100km</label>
                    <input type="number" step="0.1" value={car.consommation} onChange={e => updateCar(index, 'consommation', Number(e.target.value))} className="w-full p-1.5 border border-slate-200 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Prix Litre/kWh</label>
                    <input type="number" step="0.01" value={car.prixCarburant} onChange={e => updateCar(index, 'prixCarburant', Number(e.target.value))} className="w-full p-1.5 border border-slate-200 rounded text-sm" />
                  </div>
                </div>
              </div>

              {/* RÉSULTATS (Les 3 modes affichés) */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex-grow flex flex-col gap-3 rounded-b-xl">
                
                <div className="text-center bg-white py-2 px-3 rounded shadow-sm border border-slate-200 flex justify-between items-center">
                  <span className="text-xs text-slate-500 uppercase font-bold text-left leading-tight">Usage <br/>Mensuel</span>
                  <span className="font-bold text-slate-700 text-lg">{results[index].fraisUsage.toFixed(0)} <span className="text-sm font-normal">CHF</span></span>
                </div>

                {/* LEASING */}
                <div className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                   <div className="flex justify-between items-start mb-1 pl-2">
                      <div>
                        <span className="font-bold text-blue-800 text-sm block leading-tight">Leasing (TCO)</span>
                        <span className="text-[10px] text-blue-600 font-medium">Mens. banque: {results[index].leasing.pmt.toFixed(0)}</span>
                      </div>
                      <span className="text-xl font-black text-blue-700">{results[index].leasing.tco.toFixed(0)} <span className="text-sm font-normal">CHF</span></span>
                   </div>
                </div>

                {/* CREDIT */}
                <div className="bg-white border border-emerald-200 rounded-lg p-3 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                   <div className="flex justify-between items-start mb-1 pl-2">
                      <div>
                        <span className="font-bold text-emerald-800 text-sm block leading-tight">Crédit (TCO)</span>
                        <span className="text-[10px] text-emerald-600 font-medium">Mens. banque: {results[index].credit.pmt.toFixed(0)}</span>
                      </div>
                      <span className="text-xl font-black text-emerald-700">{results[index].credit.tco.toFixed(0)} <span className="text-sm font-normal">CHF</span></span>
                   </div>
                </div>

                {/* COMPTANT */}
                <div className="bg-white border border-purple-200 rounded-lg p-3 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                   <div className="flex justify-between items-start mb-1 pl-2">
                      <div>
                        <span className="font-bold text-purple-800 text-sm block leading-tight">Comptant</span>
                        <span className="text-[10px] text-purple-600 font-medium">TCO sans intérêts</span>
                      </div>
                      <span className="text-xl font-black text-purple-700">{results[index].comptant.tco.toFixed(0)} <span className="text-sm font-normal">CHF</span></span>
                   </div>
                </div>

              </div>
            </div>
          ))}

          {/* BOUTON AJOUTER */}
          <button 
            onClick={addCar}
            className="min-w-[300px] shrink-0 snap-center rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 flex flex-col items-center justify-center text-slate-500 hover:text-indigo-600 transition-all group"
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
  );
};

export default App;