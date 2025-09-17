# 1. Partir d'une image officielle Node.js (version 18, légère)
FROM node:18-slim

# 2. Installer les outils système et Python
# On ajoute python3-venv pour pouvoir créer des environnements virtuels
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && apt-get clean

# 3. Créer un environnement virtuel Python
ENV VENV_PATH=/opt/venv
RUN python3 -m venv $VENV_PATH

# 4. Ajouter l'environnement virtuel au PATH du système
# Cela garantit que les commandes 'python' et 'pip' utiliseront celles de l'environnement virtuel
ENV PATH="$VENV_PATH/bin:$PATH"

# 5. Définir le dossier de travail
WORKDIR /app

# 6. Copier les fichiers de configuration des dépendances
COPY package*.json ./
COPY requirements.txt ./

# 7. Installer les dépendances Python DANS l'environnement virtuel
# La protection PEP 668 est maintenant contournée proprement
RUN pip install --no-cache-dir -r requirements.txt

# 8. Installer les dépendances Node.js
RUN npm install

# 9. Copier le reste du code de notre application
COPY . .

# 10. Exposer le port que notre serveur utilise
EXPOSE 3001

# 11. La commande pour démarrer le serveur
CMD ["node", "server.js"]