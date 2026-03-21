import React, { useState, useEffect } from 'react';
import { Calculator, Car, Save, Cloud, CheckCircle, Wallet, Plus, Trash2, BarChart3, AlertCircle, Key, Users, Copy, X, Maximize2, Download, Database, Wifi, WifiOff } from 'lucide-react';
import { fetchData, saveData, checkHealth, processSyncQueue, isOnline, getQueueSize } from './api';

// --- UTILITAIRES DE CONVERSION ---

const parseDecimal = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  if (value.trim() === '') return 0;
  let normalized = value.replace(',', '.').replace(/['’\s]/g, '');
  const cleaned = normalized.replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// --- COMPOSANT DE SAISIE NUMÉRIQUE (Fix Mobile) ---
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

const App = () => {
  // --- ÉTAT AUTH & SAUVEGARDE ---
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [apiHealth, setApiHealth] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  
  const [sharedCode, setSharedCode] = useState(() => {
    return localStorage.getItem('comparateur_shared_code') || 'COMP123';
  });
  const [isCodeValid, setIsCodeValid] = useState(true);
  const [showLoadButton, setShowLoadButton] = useState(false);
  
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

  // --- VÉHICULES ---
  const [cars, setCars] = useState([
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
    }
  ]);

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
      photoUrl: "",
      commentaire: "",
      prixAchat: 40000,
      apport: 10000,
      apportCredit: 10000,
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

  // --- EFFETS (CHARGEMENT & SAUVEGARDE) ---
  useEffect(() => {
    const loadInitialData = async () => {
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
        }
      } catch (error) {
        console.warn('API non disponible');
      }
    };
    loadInitialData();
  }, [sharedCode]);

  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      const data = {
        cars, dureeMois, kmAnnuel, parking, vignette,
        tauxCreditGlobal, inflationAnnuelle, tauxPlacement,
        sharedCode, updatedAt: new Date().toISOString()
      };
      saveData(sharedCode, data).then(result => {
        if (result.success) {
          setLastSaved(new Date());
          setQueueSize(getQueueSize());
        }
      });
    }, 2000);
    return () => clearTimeout(saveTimeout);
  }, [cars, dureeMois, kmAnnuel, parking, vignette, tauxCreditGlobal, inflationAnnuelle, tauxPlacement, sharedCode]);

  useEffect(() => {
    checkHealth().then(setApiHealth);
    const healthInterval = setInterval(() => checkHealth().then(setApiHealth), 30000);
    return () => clearInterval(healthInterval);
  }, []);

  const saveDataToServer = async () => {
    setIsSaving(true);
    const data = { cars, dureeMois, kmAnnuel, parking, vignette, tauxCreditGlobal, inflationAnnuelle, tauxPlacement, sharedCode, updatedAt: new Date().toISOString() };
    try {
      const result = await saveData(sharedCode, data);
      if (result.success) {
        setLastSaved(new Date());
        if (result.queued) alert('📱 Mis en attente (Hors ligne)');
        else alert('✅ Sauvegardé sur le serveur !');
      } else {
        setSaveError(true);
      }
    } catch (error) {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  // --- MOTEUR DE CALCUL ---
  const calculateResults = () => {
    return cars.map(car => {
      const capitalFinance = car.prixAchat - car.apport;
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

      const capitalFinanceCredit = car.prixAchat - car.apportCredit;
      const rCredit = (tauxCreditGlobal / 100) / 12;
      let pmtCredit = 0;
      if (rCredit > 0) {
        pmtCredit = capitalFinanceCredit * (rCredit / (1 - Math.pow(1 + rCredit, -dureeMois)));
      } else {
        pmtCredit = capitalFinanceCredit / dureeMois;
      }
      const coutVehiculeLisseCredit = (car.apportCredit + (pmtCredit * dureeMois) - car.valeurResiduelle) / dureeMois;

      const coutVehiculeLisseComptant = (car.prixAchat - car.valeurResiduelle) / dureeMois;
      const coutFixeMensuel = (car.assurance + car.impotCantonal + vignette) / 12 + parking;
      const coutCarburantAnnuel = (kmAnnuel / 100) * car.consommation * car.prixCarburant;
      const coutVariableMensuel = (coutCarburantAnnuel + car.entretien) / 12;
      const fraisUsage = coutFixeMensuel + coutVariableMensuel;

      return {
        ...car,
        fraisUsage,
        leasing: { pmt: Math.max(0, pmtLeasing), tco: coutVehiculeLisseLeasing + fraisUsage },
        credit: { pmt: Math.max(0, pmtCredit), tco: coutVehiculeLisseCredit + fraisUsage },
        comptant: { tco: coutVehiculeLisseComptant + fraisUsage }
      };
    });
  };

  const results = calculateResults();

  const updateSharedCode = (newCode) => {
    const cleanCode = newCode.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
    setSharedCode(cleanCode);
    localStorage.setItem('comparateur_shared_code', cleanCode);
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
        setLastSaved(new Date(data.updatedAt));
        setShowLoadButton(false);
      } else {
        alert(`Aucune donnée pour "${sharedCode}"`);
      }
    } catch (error) {
      alert("Erreur de chargement");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="mb-6 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Car className="w-8 h-8 text-indigo-600" /> Comparateur Multi-Véhicules
            </h1>
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-500" />
                <input
                  type="text"
                  value={sharedCode}
                  onChange={(e) => updateSharedCode(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-indigo-700 bg-white text-center w-32"
                  maxLength={8}
                />
                <button onClick={() => navigator.clipboard.writeText(sharedCode)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 text-sm"><Copy className="w-3.5 h-3.5" /> Copier</button>
                {showLoadButton && (
                  <button onClick={loadDataForCurrentCode} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg animate-pulse flex items-center gap-1.5 text-sm"><Download className="w-3.5 h-3.5" /> Charger</button>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-sm">
              {apiHealth ? <span className="text-emerald-600 flex items-center gap-1"><Wifi className="w-4 h-4" /> SQLite Connecté</span> : <span className="text-amber-600 flex items-center gap-1"><WifiOff className="w-4 h-4" /> Hors ligne</span>}
              {queueSize > 0 && <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded flex items-center gap-1"><Database className="w-3 h-3" /> {queueSize} en attente</span>}
            </div>
            <button onClick={saveDataToServer} disabled={isSaving} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm disabled:opacity-50">
              {isSaving ? <Cloud className="w-5 h-5 animate-pulse" /> : <Save className="w-5 h-5" />} {isSaving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
            {lastSaved && <p className="text-xs text-slate-500 flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> {lastSaved.toLocaleTimeString('fr-CH')}</p>}
          </div>
        </header>

        {/* GRAPHIQUE */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-800"><BarChart3 className="w-6 h-6 text-indigo-500" /> Comparaison des Coûts Mensuels</h2>
          <div className="space-y-4">
            {(() => {
              const allData = [];
              results.forEach(r => {
                allData.push(
                  { type: 'Leasing', vehicle: r.name, value: r.leasing.tco, color: 'bg-blue-500', text: 'text-blue-700' },
                  { type: `Crédit`, vehicle: r.name, value: r.credit.tco, color: 'bg-emerald-500', text: 'text-emerald-700' },
                  { type: 'Comptant', vehicle: r.name, value: r.comptant.tco, color: 'bg-purple-500', text: 'text-purple-700' }
                );
              });
              allData.sort((a, b) => a.value - b.value);
              const maxValue = Math.max(...allData.map(d => d.value), 1);
              return allData.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700">{item.vehicle} - {item.type}</span>
                    <span className={item.text}>{item.value.toFixed(0)} CHF</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className={`${item.color} h-full transition-all duration-500`} style={{ width: `${(item.value / maxValue) * 100}%` }}></div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* PARAMÈTRES GLOBAUX */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-indigo-800"><Wallet className="w-5 h-5" /> Paramètres d'Usage</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
             <div><label className="block text-[10px] font-bold text-slate-500 uppercase">Durée (mois)</label>
             <NumericInput value={dureeMois} onChange={setDureeMois} className="w-full p-2 border rounded-md" /></div>
             <div><label className="block text-[10px] font-bold text-slate-500 uppercase">Km annuel</label>
             <NumericInput value={kmAnnuel} onChange={setKmAnnuel} className="w-full p-2 border rounded-md" /></div>
             <div><label className="block text-[10px] font-bold text-slate-500 uppercase">Parking</label>
             <NumericInput value={parking} onChange={setParking} className="w-full p-2 border rounded-md" /></div>
             <div><label className="block text-[10px] font-bold text-slate-500 uppercase">Vignette</label>
             <NumericInput value={vignette} onChange={setVignette} className="w-full p-2 border rounded-md" /></div>
             <div><label className="block text-[10px] font-bold text-emerald-600 uppercase">Taux Crédit %</label>
             <NumericInput value={tauxCreditGlobal} onChange={setTauxCreditGlobal} className="w-full p-2 border border-emerald-300 bg-emerald-50 rounded-md font-bold" /></div>
             <div><label className="block text-[10px] font-bold text-amber-600 uppercase">Inflation %</label>
             <NumericInput value={inflationAnnuelle} onChange={setInflationAnnuelle} className="w-full p-2 border border-amber-300 bg-amber-50 rounded-md" /></div>
             <div><label className="block text-[10px] font-bold text-cyan-600 uppercase">Placement %</label>
             <NumericInput value={tauxPlacement} onChange={setTauxPlacement} className="w-full p-2 border border-cyan-300 bg-cyan-50 rounded-md" /></div>
          </div>
        </div>

        {/* LISTE DES VÉHICULES */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cars.map((car, index) => (
            <div key={car.id} className="bg-white rounded-xl shadow-md border border-slate-200 flex flex-col overflow-hidden">
              <div className="bg-slate-800 p-3 flex justify-between items-center">
                <input value={car.name} onChange={e => updateCar(index, 'name', e.target.value)} className="bg-slate-700 text-white font-bold p-1 rounded w-full border-none focus:ring-1 focus:ring-indigo-400" />
                <button onClick={() => removeCar(car.id)} disabled={cars.length === 1} className="text-slate-400 hover:text-red-400 ml-2"><Trash2 className="w-5 h-5" /></button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Prix Achat (CHF)</label>
                  <NumericInput value={car.prixAchat} onChange={val => updateCar(index, 'prixAchat', val)} className="w-full p-2 border border-slate-300 rounded font-bold bg-slate-50" />
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="col-span-2 text-[10px] font-bold text-blue-800 uppercase">Leasing</div>
                  <div>
                    <label className="block text-[10px] text-blue-600">Apport</label>
                    <NumericInput value={car.apport} onChange={val => updateCar(index, 'apport', val)} className="w-full p-1.5 border border-blue-200 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-blue-600">Taux %</label>
                    <NumericInput value={car.tauxLeasing} onChange={val => updateCar(index, 'tauxLeasing', val)} className="w-full p-1.5 border border-blue-200 rounded text-sm font-bold" />
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Apport Crédit</label>
                  <NumericInput value={car.apportCredit} onChange={val => updateCar(index, 'apportCredit', val)} className="w-full p-1.5 border border-emerald-200 rounded text-sm" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Valeur Résiduelle</label>
                  <NumericInput value={car.valeurResiduelle} onChange={val => updateCar(index, 'valeurResiduelle', val)} className="w-full p-2 border border-slate-300 rounded text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><label className="text-slate-400 uppercase font-bold text-[9px]">Assurance</label>
                  <NumericInput value={car.assurance} onChange={val => updateCar(index, 'assurance', val)} className="w-full p-1.5 border border-slate-200 rounded" /></div>
                  <div><label className="text-slate-400 uppercase font-bold text-[9px]">Impôt</label>
                  <NumericInput value={car.impotCantonal} onChange={val => updateCar(index, 'impotCantonal', val)} className="w-full p-1.5 border border-slate-200 rounded" /></div>
                  <div><label className="text-slate-400 uppercase font-bold text-[9px]">Conso</label>
                  <NumericInput value={car.consommation} onChange={val => updateCar(index, 'consommation', val)} className="w-full p-1.5 border border-slate-200 rounded" /></div>
                  <div><label className="text-slate-400 uppercase font-bold text-[9px]">Prix Énergie</label>
                  <NumericInput value={car.prixCarburant} onChange={val => updateCar(index, 'prixCarburant', val)} className="w-full p-1.5 border border-slate-200 rounded" /></div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-blue-800 bg-white p-2 rounded border border-blue-200">
                  <span className="text-xs font-bold">TCO Leasing</span>
                  <span className="font-bold">{results[index].leasing.tco.toFixed(0)} CHF</span>
                </div>
                <div className="flex justify-between items-center text-emerald-800 bg-white p-2 rounded border border-emerald-200">
                  <span className="text-xs font-bold">TCO Crédit</span>
                  <span className="font-bold">{results[index].credit.tco.toFixed(0)} CHF</span>
                </div>
                <div className="flex justify-between items-center text-purple-800 bg-white p-2 rounded border border-purple-200">
                  <span className="text-xs font-bold">Comptant</span>
                  <span className="font-bold">{results[index].comptant.tco.toFixed(0)} CHF</span>
                </div>
              </div>
            </div>
          ))}
          
          <button onClick={addCar} className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-500 transition-all">
            <Plus className="w-10 h-10 mb-2" />
            <span className="font-bold">Ajouter un véhicule</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;