# Backend API pour Comparateur Auto
# Utilise Node.js Alpine (léger) + SQLite

FROM node:18-alpine

WORKDIR /app

# Installer les dépendances système pour SQLite
RUN apk add --no-cache sqlite

# Copier les fichiers de configuration
COPY package*.json ./

# Installer les dépendances Node.js
RUN npm install --omit=dev

# Copier le code source
COPY . .

# Créer le dossier pour la base de données
RUN mkdir -p /data && chown node:node /data

# Passer à l'utilisateur non-root
USER node

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/comparateur.db

# Exposition du port
EXPOSE 3000

# Commande de démarrage
CMD ["node", "server.js"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
