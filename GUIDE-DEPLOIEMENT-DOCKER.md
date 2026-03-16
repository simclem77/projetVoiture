# 📋 GUIDE DE DÉPLOIEMENT DOCKER
## Pour l'agent en charge du déploiement sur Raspberry Pi

---

## 📌 **INFORMATIONS DE BASE**

### **Matériel cible :**
- **Raspberry Pi** (modèle 3B+, 4, ou 5)
- **Adresse IP** : `192.168.50.23` (à vérifier)
- **Utilisateur** : `pi`
- **Mot de passe** : (fourni séparément)

### **Application :**
- **Nom** : Comparateur Auto Multi-Véhicules
- **Type** : React Frontend + Node.js Backend + SQLite
- **Ports** : 8080 (frontend), 3000 (backend)
- **Stockage** : Base SQLite dans `/home/pi/comparateur-data/`

---

## 🚀 **ÉTAPE 1 : PRÉPARATION DU RASPBERRY PI**

### **1.1 Connexion SSH**
```bash
# Depuis votre ordinateur
ssh pi@192.168.50.23
# Mot de passe : [À DEMANDER]
```

### **1.2 Vérification système**
```bash
# Vérifier la version
cat /etc/os-release

# Vérifier l'espace disque
df -h

# Vérifier la mémoire
free -h

# Vérifier Docker (doit être installé)
docker --version
docker-compose --version
```

### **1.3 Installation Docker (si nécessaire)**
```bash
# Si Docker n'est pas installé
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker pi

# Si Docker Compose n'est pas installé
sudo apt-get update
sudo apt-get install -y docker-compose

# Redémarrer la session SSH
exit
ssh pi@192.168.50.23
```

---

## 🛠️ **ÉTAPE 2 : DÉPLOIEMENT DE L'APPLICATION**

### **2.1 Téléchargement du code**
```bash
# Se positionner dans le dossier home
cd /home/pi

# Cloner le repository (si pas déjà fait)
git clone https://github.com/simclem77/projetVoiture.git

# OU mettre à jour si déjà existant
cd projetVoiture
git pull origin main
```

### **2.2 Exécution du script de déploiement**
```bash
# Rendre le script exécutable
chmod +x deploy-backend.sh

# Exécuter le déploiement
./deploy-backend.sh
```

### **2.3 Vérification manuelle (alternative)**
```bash
# Créer le dossier de données
sudo mkdir -p /home/pi/comparateur-data
sudo chown -R pi:pi /home/pi/comparateur-data
sudo chmod 755 /home/pi/comparateur-data

# Arrêter les anciens conteneurs
docker-compose down

# Construire les images
docker-compose build

# Démarrer les services
docker-compose up -d

# Attendre 30 secondes
sleep 30
```

---

## ✅ **ÉTAPE 3 : VÉRIFICATION DU DÉPLOIEMENT**

### **3.1 Vérification des conteneurs**
```bash
# Lister les conteneurs en cours d'exécution
docker ps

# Devrait afficher :
# - comparateur-frontend (port 8080)
# - comparateur-backend (port 3000)
```

### **3.2 Vérification des ports**
```bash
# Vérifier que les ports sont ouverts
netstat -tulpn | grep -E ':8080|:3000'

# OU avec ss
ss -tulpn | grep -E ':8080|:3000'
```

### **3.3 Tests de santé**
```bash
# Test du frontend
curl -f http://localhost:8080
echo "Frontend HTTP code: $?"

# Test du backend
curl -f http://localhost:3000/api/health
echo "Backend HTTP code: $?"

# Statistiques
curl http://localhost:3000/api/stats
```

### **3.4 Vérification des logs**
```bash
# Logs des 20 dernières lignes
docker-compose logs --tail=20

# Logs en temps réel (Ctrl+C pour arrêter)
docker-compose logs -f
```

---

## 🌐 **ÉTAPE 4 : TESTS D'ACCÈS RÉSEAU**

### **4.1 Depuis le Raspberry Pi**
```bash
# Test local
curl http://localhost:8080
curl http://localhost:3000/api/health

# Test avec l'IP locale
LOCAL_IP=$(hostname -I | awk '{print $1}')
curl http://$LOCAL_IP:8080
curl http://$LOCAL_IP:3000/api/health
```

### **4.2 Depuis un autre appareil sur le réseau**
```bash
# Remplacer 192.168.50.23 par l'IP réelle du Pi
# Sur votre ordinateur (pas sur le Pi) :
curl http://192.168.50.23:8080
curl http://192.168.50.23:3000/api/health
```

### **4.3 Test avec navigateur**
1. **Ouvrir Chrome/Firefox/Safari**
2. **Aller à** : `http://192.168.50.23:8080`
3. **Vérifier** :
   - Page de bienvenue s'affiche
   - Interface React fonctionnelle
   - Pas d'erreurs dans la console (F12)

---

## 🔧 **ÉTAPE 5 : CONFIGURATION AVANCÉE**

### **5.1 Variables d'environnement (optionnel)**
```bash
# Créer un fichier .env personnalisé
cat > .env << EOF
# Frontend
REACT_APP_API_URL=http://192.168.50.23:3000

# Backend
NODE_ENV=production
PORT=3000
DB_PATH=/data/comparateur.db

# Docker resources
FRONTEND_MEMORY_LIMIT=64M
BACKEND_MEMORY_LIMIT=96M
EOF

# Redémarrer avec les nouvelles variables
docker-compose down
docker-compose up -d
```

### **5.2 Configuration du volume de données**
```bash
# Vérifier le volume
docker volume inspect projetvoiture_comparateur-data

# Accéder aux données SQLite
sudo ls -la /home/pi/comparateur-data/
sudo sqlite3 /home/pi/comparateur-data/comparateur.db ".tables"
```

### **5.3 Sauvegarde automatique (cron)**
```bash
# Éditer le crontab
crontab -e

# Ajouter cette ligne pour backup quotidien à 2h du matin
0 2 * * * /usr/bin/sqlite3 /home/pi/comparateur-data/comparateur.db ".backup /home/pi/comparateur-data/backup-\$(date +\%Y\%m\%d).db"
```

---

## 🚨 **ÉTAPE 6 : DÉPANNAGE**

### **6.1 Problèmes courants**

#### **"Port already in use"**
```bash
# Vérifier quel processus utilise le port
sudo lsof -i :8080
sudo lsof -i :3000

# Arrêter le processus conflictuel
sudo kill -9 <PID>
```

#### **"Permission denied" sur /home/pi/comparateur-data**
```bash
sudo chown -R pi:pi /home/pi/comparateur-data
sudo chmod 755 /home/pi/comparateur-data
```

#### **Conteneurs ne démarrent pas**
```bash
# Voir les logs détaillés
docker-compose logs

# Redémarrer Docker
sudo systemctl restart docker

# Reconstruire les images
docker-compose build --no-cache
```

#### **"Connection refused" sur l'API**
```bash
# Vérifier que le backend tourne
docker ps | grep backend

# Vérifier les logs du backend
docker logs comparateur-backend

# Vérifier les variables d'environnement
docker exec comparateur-backend printenv
```

### **6.2 Commandes de diagnostic**
```bash
# État des conteneurs
docker-compose ps

# Utilisation ressources
docker stats

# Espace disque des images
docker system df

# Nettoyage (si espace insuffisant)
docker system prune -a
```

---

## 📊 **ÉTAPE 7 : VALIDATION FINALE**

### **7.1 Checklist de validation**
- [ ] **SSH** : Connexion réussie au Raspberry Pi
- [ ] **Docker** : Version ≥ 20.10, Docker Compose ≥ 1.29
- [ ] **Conteneurs** : 2 conteneurs en cours d'exécution
- [ ] **Ports** : 8080 et 3000 accessibles localement
- [ ] **Frontend** : `http://192.168.50.23:8080` accessible
- [ ] **Backend** : `http://192.168.50.23:3000/api/health` répond OK
- [ ] **Données** : Dossier `/home/pi/comparateur-data/` créé
- [ ] **Logs** : Pas d'erreur FATAL ou ERROR dans les logs
- [ ] **Réseau** : Accessible depuis autres appareils du réseau

### **7.2 Test fonctionnel complet**
```bash
# Script de test automatique
cat > /tmp/test-deploiement.sh << 'EOF'
#!/bin/bash
echo "=== TEST DE DÉPLOIEMENT ==="

# Test 1: Conteneurs
echo "1. Vérification conteneurs..."
docker ps | grep -q "comparateur-frontend" && echo "  ✅ Frontend OK" || echo "  ❌ Frontend KO"
docker ps | grep -q "comparateur-backend" && echo "  ✅ Backend OK" || echo "  ❌ Backend KO"

# Test 2: Ports
echo "2. Vérification ports..."
netstat -tulpn 2>/dev/null | grep -q ":8080" && echo "  ✅ Port 8080 OK" || echo "  ❌ Port 8080 KO"
netstat -tulpn 2>/dev/null | grep -q ":3000" && echo "  ✅ Port 3000 OK" || echo "  ❌ Port 3000 KO"

# Test 3: Services HTTP
echo "3. Test services HTTP..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200" && echo "  ✅ Frontend HTTP 200" || echo "  ❌ Frontend HTTP erreur"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health | grep -q "200" && echo "  ✅ Backend HTTP 200" || echo "  ❌ Backend HTTP erreur"

# Test 4: Données
echo "4. Vérification données..."
[ -d "/home/pi/comparateur-data" ] && echo "  ✅ Dossier données OK" || echo "  ❌ Dossier données KO"
[ -f "/home/pi/comparateur-data/comparateur.db" ] && echo "  ✅ Fichier SQLite OK" || echo "  ⚠️  Fichier SQLite absent (peut être normal au premier démarrage)"

echo "=== FIN DES TESTS ==="
EOF

chmod +x /tmp/test-deploiement.sh
/tmp/test-deploiement.sh
```

### **7.3 Rapport de déploiement**
```bash
# Générer un rapport
cat > /home/pi/deploiement-rapport-$(date +%Y%m%d).txt << EOF
=== RAPPORT DE DÉPLOIEMENT ===
Date: $(date)
Raspberry Pi: $(hostname)
IP: $(hostname -I)

=== VÉRIFICATIONS ===
Docker: $(docker --version 2>/dev/null || echo "NON INSTALLÉ")
Docker Compose: $(docker-compose --version 2>/dev/null || echo "NON INSTALLÉ")

Conteneurs actifs:
$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")

Ports ouverts:
$(netstat -tulpn 2>/dev/null | grep -E ':8080|:3000' || echo "Aucun port trouvé")

Santé API:
Frontend: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 || echo "ERREUR")
Backend: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || echo "ERREUR")

Espace disque:
$(df -h /home/pi)

=== RECOMMANDATIONS ===
1. Vérifier l'accès depuis smartphone: http://$(hostname -I | awk '{print $1}'):8080
2. Tester la synchronisation avec code FAMILY123
3. Configurer backup automatique (voir section 5.3)
4. Surveiller les logs pendant 24h: docker-compose logs --tail=50

=== CONTACT ===
En cas de problème, fournir ce rapport complet.
EOF

# Afficher le rapport
cat /home/pi/deploiement-rapport-$(date +%Y%m%d).txt
```

---

## 📞 **SUPPORT ET MAINTENANCE**

### **Contacts :**
- **Développeur** : Simon (repository GitHub)
- **Agent déploiement** : [VOTRE NOM]
- **Utilisateur final** : Propriétaire du Raspberry Pi

### **Informations à conserver :**
- **IP Raspberry Pi** : `192.168.50.23` (à confirmer)
- **Ports** : 8080 (web), 3000 (API)
- **Dossier données** : `/home/pi/comparateur-data/`
- **Repository** : `https://github.com/simclem77/projetVoiture`
- **Commit déployé** : `$(git log -1 --oneline)`

### **Procédure de mise à jour :**
```bash
cd /home/pi/projetVoiture
git pull origin main
docker-compose build
docker-compose up -d
docker system prune -a  # Nettoyage optionnel
```

---

## 🎯 **RÉSUMÉ POUR L'AGENT**

### **À faire ABSOLUMENT :**
1. ✅ **Se connecter** en SSH au Raspberry Pi
2. ✅ **Vérifier** que Docker est installé
3. ✅ **Exécuter** `./deploy-backend.sh`
4. ✅ **Tester** `http://[IP]:8080` depuis smartphone
5. ✅ **Vérifier** la synchronisation avec un code test

### **À documenter :**
- ✅ **IP réelle** du Raspberry Pi
- ✅ **Problèmes** rencontrés pendant le déploiement
- ✅ **Tests** réussis/échoués
- ✅ **Accès** depuis réseau local

### **Livrables attendus :**
1. **Rapport de déploiement** (fichier texte)
2. **URL d'accès** pour l'utilisateur
3. **Instructions** de maintenance basique
4. **Contacts** en cas de problème

---

**⚠️ IMPORTANT :** Ce guide suppose que le Raspberry Pi est déjà sur le réseau `192.168.50.0/24`. Si l'IP est différente, ajuster toutes les références à `192.168.50.23` avec l'IP réelle.

**✅ DÉPLOIEMENT RÉUSSI QUAND :**
- L'application est accessible sur `http://[IP]:8080`
- L'API répond sur `http://[IP]:3000/api/health`
- La synchronisation fonctionne entre 2 appareils
- Les données persistent après redémarrage