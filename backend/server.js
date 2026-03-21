const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Configuration
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/data/comparateur.db';

// Assurer que le dossier data existe
const dataDir = '/data';
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Dossier /data créé');
  } catch (err) {
    console.warn('⚠️ Impossible de créer /data, utilisation du dossier courant:', err.message);
    // Fallback au dossier courant
    const fallbackDir = path.join(__dirname, 'data');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
  }
}

// Initialiser la base de données
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erreur connexion SQLite:', err.message);
  } else {
    console.log('✅ Connecté à la base SQLite:', DB_PATH);
    initializeDatabase();
  }
});

// Initialiser les tables
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS simulations (
      code TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Erreur création table:', err.message);
    } else {
      console.log('✅ Table simulations prête');
    }
  });

  // Table pour l'historique (optionnel)
  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (code) REFERENCES simulations(code)
    )
  `, (err) => {
    if (err) {
      console.error('Erreur création table history:', err.message);
    } else {
      console.log('✅ Table history prête');
    }
  });
}

// Créer l'application Express
const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? '*'  // En production, accepter toutes les origines
    : ['http://localhost:8080', 'http://localhost:3000', 'http://192.168.50.23:8080'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'SQLite',
    path: DB_PATH
  });
});

// GET : Récupérer les données d'un code
app.get('/api/data/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  
  db.get('SELECT data, updated_at FROM simulations WHERE code = ?', [code], (err, row) => {
    if (err) {
      console.error('Erreur GET:', err.message);
      res.status(500).json({ error: 'Erreur base de données' });
    } else if (row) {
      try {
        const data = JSON.parse(row.data);
        res.json({
          success: true,
          code,
          data,
          updatedAt: row.updated_at,
          fromCache: false
        });
      } catch (parseError) {
        console.error('Erreur parsing JSON:', parseError);
        res.status(500).json({ error: 'Données corrompues' });
      }
    } else {
      // Aucune donnée pour ce code
      res.json({
        success: true,
        code,
        data: null,
        message: 'Aucune donnée trouvée pour ce code'
      });
    }
  });
});

// POST : Sauvegarder ou mettre à jour les données
app.post('/api/data/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const data = req.body;
  
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Données invalides' });
  }
  
  const dataJson = JSON.stringify(data);
  const timestamp = new Date().toISOString();
  
  // Transaction pour garantir l'intégrité
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Sauvegarder dans l'historique d'abord
    db.run(
      'INSERT INTO history (code, data) VALUES (?, ?)',
      [code, dataJson],
      (err) => {
        if (err) {
          console.error('Erreur historique:', err.message);
        }
      }
    );
    
    // Mettre à jour ou insérer les données
    db.run(
      `INSERT OR REPLACE INTO simulations (code, data, updated_at) 
       VALUES (?, ?, ?)`,
      [code, dataJson, timestamp],
      function(err) {
        if (err) {
          console.error('Erreur sauvegarde:', err.message);
          db.run('ROLLBACK');
          res.status(500).json({ error: 'Erreur sauvegarde' });
        } else {
          db.run('COMMIT');
          res.json({
            success: true,
            code,
            message: 'Données sauvegardées',
            updatedAt: timestamp,
            changes: this.changes
          });
        }
      }
    );
  });
});

// GET : Liste de tous les codes disponibles
app.get('/api/codes', (req, res) => {
  db.all('SELECT code, updated_at FROM simulations ORDER BY updated_at DESC', (err, rows) => {
    if (err) {
      console.error('Erreur liste codes:', err.message);
      res.status(500).json({ error: 'Erreur base de données' });
    } else {
      res.json({
        success: true,
        count: rows.length,
        codes: rows.map(row => ({
          code: row.code,
          updatedAt: row.updated_at,
          lastUpdate: new Date(row.updated_at).toLocaleString('fr-FR')
        }))
      });
    }
  });
});

// DELETE : Supprimer un code (optionnel)
app.delete('/api/data/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  
  db.run('DELETE FROM simulations WHERE code = ?', [code], function(err) {
    if (err) {
      console.error('Erreur suppression:', err.message);
      res.status(500).json({ error: 'Erreur suppression' });
    } else {
      res.json({
        success: true,
        code,
        message: 'Code supprimé',
        changes: this.changes
      });
    }
  });
});

// GET : Historique d'un code (optionnel)
app.get('/api/history/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const limit = parseInt(req.query.limit) || 10;
  
  db.all(
    'SELECT id, data, created_at FROM history WHERE code = ? ORDER BY created_at DESC LIMIT ?',
    [code, limit],
    (err, rows) => {
      if (err) {
        console.error('Erreur historique:', err.message);
        res.status(500).json({ error: 'Erreur historique' });
      } else {
        res.json({
          success: true,
          code,
          history: rows.map(row => ({
            id: row.id,
            data: JSON.parse(row.data),
            createdAt: row.created_at
          }))
        });
      }
    }
  );
});

// Backup de la base de données (optionnel)
app.get('/api/backup', (req, res) => {
  const backupPath = `${DB_PATH}.backup.${Date.now()}`;
  
  db.backup(backupPath, (err) => {
    if (err) {
      console.error('Erreur backup:', err.message);
      res.status(500).json({ error: 'Erreur backup' });
    } else {
      res.json({
        success: true,
        message: 'Backup créé',
        path: backupPath,
        size: fs.statSync(backupPath).size
      });
    }
  });
});

// Statistiques
app.get('/api/stats', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM simulations', (err, row) => {
    if (err) {
      console.error('Erreur stats:', err.message);
      res.status(500).json({ error: 'Erreur statistiques' });
    } else {
      db.get('SELECT MAX(updated_at) as last_update FROM simulations', (err, row2) => {
        if (err) {
          res.json({
            simulations: row.count,
            lastUpdate: null
          });
        } else {
          res.json({
            simulations: row.count,
            lastUpdate: row2.last_update,
            databaseSize: fs.statSync(DB_PATH).size
          });
        }
      });
    }
  });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('Erreur globale:', err.stack);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 API REST démarrée sur http://localhost:${PORT}`);
  console.log(`📁 Base de données: ${DB_PATH}`);
  console.log(`🌐 CORS activé pour: localhost:8080, 192.168.50.23:8080`);
  console.log(`📊 Endpoints disponibles:`);
  console.log(`   GET  /api/health          - Santé de l'API`);
  console.log(`   GET  /api/data/:code      - Récupérer données`);
  console.log(`   POST /api/data/:code      - Sauvegarder données`);
  console.log(`   GET  /api/codes           - Liste des codes`);
  console.log(`   GET  /api/stats           - Statistiques`);
  console.log(`   GET  /api/history/:code   - Historique`);
  console.log(`   GET  /api/backup          - Backup DB`);
});

// Gestion arrêt propre
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur...');
  db.close((err) => {
    if (err) {
      console.error('Erreur fermeture DB:', err.message);
    } else {
      console.log('✅ Base de données fermée');
    }
    process.exit(0);
  });
});

module.exports = app;