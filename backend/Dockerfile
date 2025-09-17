# 1. Partir d'une image officielle Node.js
FROM node:18-slim

# 2. Installer les outils système et Python
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && apt-get clean

# 3. Créer et activer un environnement virtuel
ENV VENV_PATH=/opt/venv
RUN python3 -m venv $VENV_PATH
ENV PATH="$VENV_PATH/bin:$PATH"

# 4. Définir le dossier de travail dans le conteneur
WORKDIR /app

# 5. Copier UNIQUEMENT les fichiers du backend dans le dossier de travail
COPY backend/package*.json ./
COPY backend/requirements.txt ./

# 6. Installer les dépendances Python DANS l'environnement virtuel
RUN pip install --no-cache-dir -r requirements.txt

# 7. Installer les dépendances Node.js
RUN npm install

# 8. Copier le reste du code du backend
COPY backend/ .

# 9. Exposer le port
EXPOSE 3001

# 10. La commande pour démarrer le serveur
CMD ["node", "server.js"]