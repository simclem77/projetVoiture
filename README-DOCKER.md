# Comparateur Auto - Déploiement sur Raspberry Pi

Application React pour comparer les coûts de véhicules, optimisée pour Raspberry Pi avec Docker.

## 🎯 **Fonctionnalités**

- ✅ **Mode 100% local** - Pas de Firebase, pas d'internet requis
- ✅ **Stockage localStorage** - Données sauvegardées dans le navigateur
- ✅ **Code partagé** `COMP123` - Même code sur tous vos appareils
- ✅ **Interface identique** - Même UI qu'avant mais plus rapide
- ✅ **Docker conteneurisé** - Facile à déployer et maintenir

## 🐳 **Déploiement avec Docker**

### **Option 1 : Déploiement automatique (recommandé)**

```bash
# 1. Rendre le script exécutable
chmod +x deploy.sh

# 2. Déployer (remplacez l'IP par celle de votre Pi)
./deploy.sh 192.168.1.100
```

### **Option 2 : Déploiement manuel**

**Sur votre machine de développement :**
```bash
# 1. Build l'image Docker
docker build -t comparateur-auto:latest .

# 2. Sauvegarder l'image
docker save comparateur-auto:latest -o comparateur-auto.tar

# 3. Copier sur le Raspberry Pi
scp comparateur-auto.tar pi@192.168.1.100:~/
```

**Sur le Raspberry Pi (en SSH) :**
```bash
# 1. Charger l'image
docker load -i ~/comparateur-auto.tar

# 2. Lancer le conteneur
docker run -d \
  --name comparateur-auto \
  --restart unless-stopped \
  -p 8080:80 \
  comparateur-auto:latest

# 3. Vérifier
docker ps
curl http://localhost:8080
```

### **Option 3 : Docker Compose (meilleure pour la production)**

**Sur le Raspberry Pi :**
```bash
# 1. Copier tous les fichiers sur le Pi
scp -r Dockerfile nginx.conf docker-compose.yml pi@192.168.1.100:~/comparateur/

# 2. Se connecter en SSH
ssh pi@192.168.1.100

# 3. Démarrer avec docker-compose
cd ~/comparateur
docker-compose up -d

# 4. Vérifier
docker-compose ps
```

## 🌐 **Accès à l'application**

- **Local** : `http://192.168.1.100:8080` (remplacez par l'IP de votre Pi)
- **Réseau local** : Même adresse depuis n'importe quel appareil
- **DNS local** : Configurez `comparateur.local` dans Pi-hole DNS

## 🔧 **Configuration**

### **Ports**
- **Application** : Port `8080` (pour éviter le conflit avec Pi-hole sur le port 80)
- **Pi-hole** : Continue sur le port `80` (admin: `http://pi.hole/admin`)

### **Ressources (optimisées pour Raspberry Pi)**
- **RAM** : 128MB maximum
- **CPU** : 0.5 core maximum
- **Stockage** : ~50MB pour l'image Docker

### **Persistance**
- **Logs Nginx** : Volume Docker `nginx-logs`
- **Données** : Stockées dans `localStorage` du navigateur (pas de volume nécessaire)

## 🚀 **Avantages du déploiement Docker**

### **Performance**
- ✅ **Latence <1ms** - Tout est local sur le Pi
- ✅ **Chargement instantané** - Fichiers statiques servis par Nginx
- ✅ **Cache agressif** - Fichiers en cache 1 an

### **Maintenance**
- ✅ **Mises à jour simples** : `docker-compose pull && docker-compose up -d`
- ✅ **Logs centralisés** : `docker logs comparateur-auto`
- ✅ **Monitoring** : `docker stats comparateur-auto`
- ✅ **Backup** : Sauvegarder le volume de logs

### **Sécurité**
- ✅ **Conteneur isolé** - Pas d'accès au système hôte
- ✅ **User non-root** dans le conteneur
- ✅ **Headers de sécurité** (X-Frame-Options, XSS Protection, etc.)

## 🔄 **Mises à jour**

### **Méthode 1 : Rebuild complet**
```bash
# Sur votre machine de développement
./deploy.sh 192.168.1.100
```

### **Méthode 2 : Mise à jour incrémentale**
```bash
# Sur le Raspberry Pi
cd ~/comparateur
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

### **Méthode 3 : Via Git (si vous clonez sur le Pi)**
```bash
# Sur le Raspberry Pi
cd ~/comparateur
git pull
docker-compose up -d --build
```

## 🐛 **Dépannage**

### **L'application ne s'affiche pas**
```bash
# Vérifier les logs
docker logs comparateur-auto

# Vérifier si le conteneur tourne
docker ps

# Tester depuis le Pi
curl http://localhost:8080
```

### **Problèmes de port**
```bash
# Vérifier les ports utilisés
sudo netstat -tulpn | grep :8080

# Changer le port dans docker-compose.yml
# De: "8080:80" à "8081:80" par exemple
```

### **Problèmes de mémoire**
```bash
# Vérifier l'utilisation mémoire
docker stats comparateur-auto

# Augmenter la limite dans docker-compose.yml
# De: memory: 128M à memory: 256M
```

## 📊 **Monitoring**

### **Statistiques en temps réel**
```bash
docker stats comparateur-auto
```

### **Logs**
```bash
# Logs en temps réel
docker logs -f comparateur-auto

# Logs des dernières 24h
docker logs --since 24h comparateur-auto
```

### **Santé du conteneur**
```bash
docker inspect --format='{{.State.Health.Status}}' comparateur-auto
```

## 🎨 **Personnalisation**

### **Changer le port**
Modifiez `docker-compose.yml` :
```yaml
ports:
  - "3000:80"  # Nouveau port externe
```

### **Changer le nom du conteneur**
```yaml
container_name: mon-comparateur-auto
```

### **Ajouter un réseau personnalisé**
```yaml
networks:
  - mon-reseau
```

## 🤝 **Support**

- **Problèmes** : Ouvrir une issue sur GitHub
- **Questions** : Consulter la documentation
- **Améliorations** : Pull requests bienvenues

## 📝 **Notes techniques**

- **Build multi-stage** : Node.js pour le build, Nginx pour la production
- **Optimisations** : Gzip, cache, headers de sécurité
- **SPA compatible** : Routes React gérées par Nginx
- **Lightweight** : Image Alpine Linux (~20MB)

---

**🎉 Votre comparateur est maintenant prêt pour le Raspberry Pi !**