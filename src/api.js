// API client pour le backend SQLite
// Gère la synchronisation entre appareils

// Détecter automatiquement l'URL de l'API basée sur l'hôte actuel
const getApiUrl = () => {
  // Si variable d'environnement définie, l'utiliser
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // En production (Docker), utiliser le même hôte que le frontend mais sur le port 3000
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:3000`;
  }
  
  // En développement local
  return 'http://localhost:3000';
};

const API_URL = getApiUrl();
console.log('🔗 API URL:', API_URL);

// Cache local pour mode hors ligne
let offlineCache = new Map();
let onlineStatus = navigator.onLine;
let syncQueue = [];

// Détecter les changements de connexion
window.addEventListener('online', () => {
  console.log('✅ Connexion rétablie');
  onlineStatus = true;
  processSyncQueue();
});

window.addEventListener('offline', () => {
  console.log('⚠️ Mode hors ligne');
  onlineStatus = false;
});

// Fonction pour vérifier la santé de l'API
export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_URL}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch (error) {
    console.warn('API non disponible:', error.message);
    return false;
  }
};

// Récupérer les données d'un code
export const fetchData = async (code) => {
  const cacheKey = `data_${code}`;
  
  // Vérifier le cache local d'abord
  if (offlineCache.has(cacheKey)) {
    console.log('📦 Données depuis le cache local');
    return offlineCache.get(cacheKey);
  }
  
  // Essayer l'API si en ligne
  if (onlineStatus) {
    try {
      const response = await fetch(`${API_URL}/api/data/${code}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        // Mettre en cache
        offlineCache.set(cacheKey, result.data);
        // Sauvegarder aussi dans localStorage comme fallback (deux clés pour compatibilité)
        localStorage.setItem(`cache_${code}`, JSON.stringify({
          data: result.data,
          timestamp: new Date().toISOString(),
          fromApi: true
        }));
        localStorage.setItem(`comparateur_${code}`, JSON.stringify(result.data));
        return result.data;
      }
      
      return null; // Aucune donnée pour ce code
      
    } catch (error) {
      console.warn('Erreur fetch API:', error.message);
      // Fallback au localStorage
      return getFromLocalStorage(code);
    }
  } else {
    // Mode hors ligne : utiliser localStorage
    return getFromLocalStorage(code);
  }
};

// Sauvegarder les données
export const saveData = async (code, data) => {
  const cacheKey = `data_${code}`;
  
  // Mettre à jour le cache local immédiatement
  offlineCache.set(cacheKey, data);
  
  // Sauvegarder dans localStorage comme backup (deux clés pour compatibilité)
  const cacheData = JSON.stringify({
    data,
    timestamp: new Date().toISOString(),
    fromApi: false
  });
  localStorage.setItem(`cache_${code}`, cacheData);
  // Aussi sauvegarder avec la clé utilisée par App.jsx
  localStorage.setItem(`comparateur_${code}`, JSON.stringify(data));
  
  // Si hors ligne, mettre dans la queue de synchronisation
  if (!onlineStatus) {
    console.log('📝 Ajout à la queue de sync (hors ligne)');
    syncQueue.push({ code, data, timestamp: new Date().toISOString() });
    localStorage.setItem('sync_queue', JSON.stringify(syncQueue));
    return { success: true, queued: true, message: 'En attente de synchronisation' };
  }
  
  // Sinon, envoyer à l'API
  try {
    const response = await fetch(`${API_URL}/api/data/${code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Données sauvegardées sur le serveur');
    return result;
    
  } catch (error) {
    console.warn('Erreur sauvegarde API:', error.message);
    // Mettre dans la queue pour retry plus tard
    syncQueue.push({ code, data, timestamp: new Date().toISOString() });
    localStorage.setItem('sync_queue', JSON.stringify(syncQueue));
    return { 
      success: false, 
      queued: true, 
      message: 'Erreur API, mise en queue pour retry' 
    };
  }
};

// Traiter la queue de synchronisation
export const processSyncQueue = async () => {
  if (syncQueue.length === 0) {
    const storedQueue = localStorage.getItem('sync_queue');
    if (storedQueue) {
      syncQueue = JSON.parse(storedQueue);
    }
  }
  
  if (syncQueue.length === 0 || !onlineStatus) {
    return { processed: 0, failed: 0 };
  }
  
  console.log(`🔄 Traitement de ${syncQueue.length} éléments en queue`);
  
  let processed = 0;
  let failed = 0;
  const remaining = [];
  
  for (const item of syncQueue) {
    try {
      const response = await fetch(`${API_URL}/api/data/${item.code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
      });
      
      if (response.ok) {
        processed++;
        console.log(`✅ Sync réussie pour ${item.code}`);
      } else {
        failed++;
        remaining.push(item);
        console.warn(`❌ Sync échouée pour ${item.code}`);
      }
    } catch (error) {
      failed++;
      remaining.push(item);
      console.warn(`❌ Erreur sync pour ${item.code}:`, error.message);
    }
  }
  
  // Mettre à jour la queue
  syncQueue = remaining;
  localStorage.setItem('sync_queue', JSON.stringify(syncQueue));
  
  return { processed, failed, remaining: syncQueue.length };
};

// Récupérer depuis localStorage (fallback)
const getFromLocalStorage = (code) => {
  try {
    // Essayer d'abord la clé cache_
    const cached = localStorage.getItem(`cache_${code}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      console.log('📦 Données depuis localStorage (cache_)');
      return parsed.data;
    }
    
    // Sinon essayer la clé comparateur_
    const comparateur = localStorage.getItem(`comparateur_${code}`);
    if (comparateur) {
      console.log('📦 Données depuis localStorage (comparateur_)');
      return JSON.parse(comparateur);
    }
  } catch (error) {
    console.warn('Erreur lecture localStorage:', error);
  }
  return null;
};

// Lister tous les codes disponibles
export const listCodes = async () => {
  if (!onlineStatus) {
    // En mode hors ligne, retourner les codes du cache local
    const codes = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('cache_')) {
        const code = key.replace('cache_', '');
        codes.push({ code, source: 'local' });
      }
    }
    return { success: true, codes, fromCache: true };
  }
  
  try {
    const response = await fetch(`${API_URL}/api/codes`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result;
    
  } catch (error) {
    console.warn('Erreur liste codes:', error.message);
    return { success: false, codes: [], error: error.message };
  }
};

// Statistiques
export const getStats = async () => {
  if (!onlineStatus) {
    return { success: false, message: 'Hors ligne' };
  }
  
  try {
    const response = await fetch(`${API_URL}/api/stats`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.warn('Erreur stats:', error.message);
    return { success: false, error: error.message };
  }
};

// Fonction pour obtenir la taille de la queue
export const getQueueSize = () => syncQueue.length;

// Fonction pour vérifier si en ligne
export const isOnline = () => onlineStatus;

// Initialiser la queue depuis localStorage
const storedQueue = localStorage.getItem('sync_queue');
if (storedQueue) {
  try {
    syncQueue = JSON.parse(storedQueue);
    console.log(`📋 Queue chargée: ${syncQueue.length} éléments`);
  } catch (error) {
    console.warn('Erreur parsing queue:', error);
  }
}

// Tenter une sync automatique au démarrage si en ligne
if (onlineStatus && syncQueue.length > 0) {
  setTimeout(() => {
    processSyncQueue().then(result => {
      if (result.processed > 0) {
        console.log(`✅ Sync auto: ${result.processed} éléments traités`);
      }
    });
  }, 5000);
}

export default {
  checkHealth,
  fetchData,
  saveData,
  listCodes,
  getStats,
  processSyncQueue,
  isOnline,
  getQueueSize,
};
