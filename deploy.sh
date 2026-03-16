#!/bin/bash

# Script de déploiement pour Raspberry Pi
# Usage: ./deploy.sh [IP_DU_RASPBERRY_PI]

set -e  # Arrêter en cas d'erreur

# Configuration
PI_USER="pi"
PI_IP="${1:-192.168.1.100}"  # IP par défaut ou premier argument
APP_NAME="comparateur-auto"
DOCKER_IMAGE="comparateur-auto:latest"

echo "🚀 Déploiement de l'application sur Raspberry Pi ($PI_IP)"
echo "======================================================"

# 1. Build local de l'image Docker
echo "📦 Building l'image Docker localement..."
docker build -t $DOCKER_IMAGE .

# 2. Sauvegarde de l'image en tar
echo "💾 Sauvegarde de l'image..."
docker save $DOCKER_IMAGE -o $APP_NAME.tar

# 3. Copie sur le Raspberry Pi
echo "📤 Copie sur le Raspberry Pi..."
scp $APP_NAME.tar $PI_USER@$PI_IP:~/

# 4. Commands à exécuter sur le Raspberry Pi
echo "📝 Exécution des commands sur le Raspberry Pi..."
ssh $PI_USER@$PI_IP << EOF
  echo "1. Chargement de l'image Docker..."
  docker load -i ~/$APP_NAME.tar
  
  echo "2. Arrêt du conteneur existant (si présent)..."
  docker stop $APP_NAME 2>/dev/null || true
  docker rm $APP_NAME 2>/dev/null || true
  
  echo "3. Lancement du nouveau conteneur..."
  docker run -d \
    --name $APP_NAME \
    --restart unless-stopped \
    -p 8080:80 \
    $DOCKER_IMAGE
  
  echo "4. Nettoyage..."
  rm ~/$APP_NAME.tar
  
  echo "5. Vérification..."
  sleep 2
  docker ps | grep $APP_NAME
  echo "✅ Déploiement terminé !"
  echo "🌐 Accès: http://$PI_IP:8080"
EOF

# 5. Nettoyage local
echo "🧹 Nettoyage local..."
rm $APP_NAME.tar

echo "🎉 Déploiement réussi !"
echo "👉 Accédez à l'application: http://$PI_IP:8080"
echo "👉 Ou avec docker-compose: ssh $PI_USER@$PI_IP 'cd ~/ && docker-compose up -d'"