// server.js

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path'); // N'oubliez pas d'importer le module 'path'

// Initialisation de l'application Express
const app = express();
const PORT = 3001; // On choisit un port différent de celui du front-end

// Middleware CORS pour autoriser les requêtes depuis votre front-end
app.use(cors());

// --- AJOUT IMPORTANT ---
// Middleware pour servir les fichiers statiques (HTML, CSS, JS) depuis la racine du projet.
// __dirname est une variable Node.js qui contient le chemin du répertoire actuel.
app.use(express.static(path.join(__dirname, '.')));
// --------------------

// On crée une route unique '/proxy' qui fera tout le travail
app.get('/proxy', async (req, res) => {
    // On récupère l'URL de l'API PMU à contacter depuis les paramètres de la requête
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Le paramètre "url" est manquant' });
    }

    console.log(`Proxying request to: ${targetUrl}`);

    try {
        // On utilise Axios pour faire la requête à l'API PMU
        const response = await axios.get(targetUrl, {
            // On peut se faire passer pour un navigateur pour plus de compatibilité
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // On renvoie les données reçues de l'API PMU directement au front-end
        res.json(response.data);

    } catch (error) {
        console.error('Erreur lors de la requête proxy:', error.message);
        // On renvoie un statut d'erreur clair au front-end
        res.status(error.response?.status || 500).json({ 
            error: 'Impossible de récupérer les données depuis la source distante.',
            details: error.message 
        });
    }
});

// On démarre le serveur
app.listen(PORT, () => {
    console.log(`Backend proxy et serveur de fichiers démarrés sur http://localhost:${PORT}`);
    console.log(`Accédez à votre application via http://localhost:${PORT}/index.html`);
});