#!/bin/bash

# Script de déploiement pour le backend SQLite + frontend React
# À exécuter sur le Raspberry Pi

set -e

echo "🚀 Déploiement du Comparateur Auto avec SQLite..."

# Vérifier Docker et Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Installation..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé. Installation..."
    sudo apt-get update
    sudo apt-get install -y docker-compose
fi

# Créer le dossier pour les données SQLite
echo "📁 Création du dossier pour les données..."
sudo mkdir -p /home/pi/comparateur-data
sudo chown -R pi:pi /home/pi/comparateur-data
sudo chmod 755 /home/pi/comparateur-data

# Arrêter les conteneurs existants
echo "🛑 Arrêt des conteneurs existants..."
docker-compose down || true

# Construire les images
echo "🔨 Construction des images Docker..."
docker-compose build

# Démarrer les services
echo "🚀 Démarrage des services..."
docker-compose up -d

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 10

# Vérifier la santé des services
echo "🏥 Vérification de la santé des services..."

# Vérifier le frontend
if curl -f http://localhost:8080 > /dev/null 2>&1; then
    echo "✅ Frontend React démarré sur http://localhost:8080"
else
    echo "⚠️  Frontend non accessible sur le port 8080"
fi

# Vérifier le backend
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Backend API SQLite démarré sur http://localhost:3000"
    echo "📊 Statistiques API:"
    curl -s http://localhost:3000/api/stats | jq . || echo "  (format JSON non disponible)"
else
    echo "⚠️  Backend non accessible sur le port 3000"
fi

# Afficher les logs des conteneurs
echo "📋 Logs des conteneurs:"
docker-compose logs --tail=10

# Instructions
echo ""
echo "================================================"
echo "✅ DÉPLOIEMENT TERMINÉ !"
echo "================================================"
echo ""
echo "🌐 Accès à l'application:"
echo "   Frontend: http://$(hostname -I | awk '{print $1}'):8080"
echo "   Backend API: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "📁 Données SQLite:"
echo "   Emplacement: /home/pi/comparateur-data/comparateur.db"
echo "   Taille: $(du -h /home/pi/comparateur-data/comparateur.db 2>/dev/null || echo 'Fichier en cours de création')"
echo ""
echo "🔧 Commandes utiles:"
echo "   Voir les logs: docker-compose logs -f"
echo "   Arrêter: docker-compose down"
echo "   Redémarrer: docker-compose restart"
echo "   Mettre à jour: git pull && docker-compose build && docker-compose up -d"
echo ""
echo "📱 Synchronisation entre appareils:"
echo "   1. Utilisez le même code sur tous vos appareils"
echo "   2. Les données se synchronisent automatiquement via SQLite"
echo "   3. Mode hors ligne supporté avec queue de synchronisation"
echo ""
echo "🔒 Sécurité:"
echo "   - Les données restent sur votre Raspberry Pi"
echo "   - Pas de cloud externe"
echo "   - Backup automatique dans /home/pi/comparateur-data/"
echo ""
echo "💡 Pour tester:"
echo "   1. Ouvrez http://$(hostname -I | awk '{print $1}'):8080 sur votre smartphone"
echo "   2. Entrez un code (ex: FAMILY123)"
echo "   3. Modifiez des données"
echo "   4. Ouvrez sur un autre appareil avec le même code"
echo "   5. Cliquez sur 'Charger' pour synchroniser"
echo "================================================"

# Vérifier les ports utilisés
echo ""
echo "🔍 Ports en écoute:"
netstat -tulpn | grep -E ':8080|:3000' || echo "   (Les ports peuvent mettre quelques secondes à apparaître)"

# Sauvegarder la configuration
echo ""
echo "💾 Configuration sauvegardée dans ~/.comparateur-deploy"
cat > ~/.comparateur-deploy << EOF
# Configuration du Comparateur Auto
DEPLOY_DATE=$(date)
FRONTEND_URL=http://$(hostname -I | awk '{print $1}'):8080
BACKEND_URL=http://$(hostname -I | awk '{print $1}'):3000
DATA_PATH=/home/pi/comparateur-data
DOCKER_COMPOSE_PATH=$(pwd)/docker-compose.yml

# Commandes de maintenance
# Redémarrer: cd $(pwd) && docker-compose restart
# Mettre à jour: cd $(pwd) && git pull && docker-compose build && docker-compose up -d
# Voir les logs: cd $(pwd) && docker-compose logs -f
# Backup DB: sqlite3 /home/pi/comparateur-data/comparateur.db ".backup /home/pi/comparateur-data/backup-\$(date +%Y%m%d).db"
EOF

echo "✅ Configuration sauvegardée dans ~/.comparateur-deploy"