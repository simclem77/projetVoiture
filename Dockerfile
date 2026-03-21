# Étape 1 : Build de l'application
FROM node:18-alpine AS builder

WORKDIR /app

# Copier les fichiers de configuration
COPY package*.json ./
COPY vite.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Installer les dépendances
RUN npm install

# Copier le code source
COPY index.html ./
COPY src/ ./src/

# Build l'application
RUN npm run build

# Étape 2 : Serveur de production
FROM nginx:alpine

# Copier les fichiers buildés depuis l'étape builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuration Nginx optimisée pour SPA
COPY nginx.conf /etc/nginx/nginx.conf

# Exposition du port
EXPOSE 80

# Démarrage de Nginx
CMD ["nginx", "-g", "daemon off;"]