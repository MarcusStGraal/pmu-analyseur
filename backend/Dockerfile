# 1. Partir d'une image officielle Node.js (version 18, légère)
FROM node:18-slim

# 2. Installer Python et pip, qui sont nécessaires pour nos scripts
RUN apt-get update && apt-get install -y python3 python3-pip

# 3. Définir le dossier de travail à l'intérieur du conteneur
WORKDIR /app

# 4. Copier les fichiers de notre backend dans le conteneur
COPY package*.json ./
COPY requirements.txt ./
COPY runtime.txt ./

# 5. Installer les dépendances Python d'abord
RUN pip install --no-cache-dir -r requirements.txt

# 6. Installer les dépendances Node.js
RUN npm install

# 7. Copier le reste du code de notre application
COPY . .

# 8. Exposer le port que notre serveur utilise
EXPOSE 3001

# 9. La commande pour démarrer le serveur
CMD ["node", "server.js"]