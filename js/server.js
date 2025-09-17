const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json()); // Middleware pour parser le JSON des requêtes POST

// Route proxy existante
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).json({ error: 'Le paramètre "url" est manquant' });
    }
    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            error: 'Impossible de récupérer les données depuis la source distante.',
            details: error.message
        });
    }
});

// NOUVELLE ROUTE : Endpoint pour la prédiction Dutching
app.post('/predict-dutching', (req, res) => {
    const { strategie, cotes, indices_forme, gains_par_course } = req.body;

    // Validation simple des entrées
    if (!strategie || !cotes || !indices_forme || !gains_par_course) {
        return res.status(400).json({ error: 'Données manquantes pour la prédiction.' });
    }
    if (cotes.length !== strategie || indices_forme.length !== strategie || gains_par_course.length !== strategie) {
        return res.status(400).json({ error: 'Incohérence dans le nombre de données fournies.' });
    }

    const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPath = path.join(__dirname, 'predict_dutching.py');

    // Construction de la commande
    const command = [
        pythonExecutable,
        `"${scriptPath}"`,
        '-s', strategie,
        '-c', ...cotes,
        '-i', ...indices_forme,
        '-g', ...gains_par_course
    ].join(' ');

    console.log(`Exécution de la commande : ${command}`);

    // Exécution du script Python
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erreur d'exécution: ${error.message}`);
            return res.status(500).json({ error: "Erreur lors de l'exécution du script de prédiction.", details: error.message });
        }
        if (stderr) {
            console.error(`Erreur stderr: ${stderr}`);
            // On peut choisir de continuer si ce ne sont que des warnings, ou de s'arrêter
             if (!stdout) { // S'il n'y a pas de sortie standard, c'est probablement une vraie erreur
                return res.status(500).json({ error: "Erreur dans le script de prédiction.", details: stderr });
             }
        }

        // Parsing de la sortie du script pour la renvoyer en JSON
        try {
            const lines = stdout.trim().split('\n');
            const gainLine = lines.find(line => line.includes('Prédiction du Gain Net'));
            const decisionLine = lines.find(line => line.startsWith('✅') || line.startsWith('❌'));

            if (!gainLine || !decisionLine) {
                 throw new Error('Format de sortie du script inattendu.');
            }
            
            const gainNet = parseFloat(gainLine.split(':')[1].trim().split(' ')[0]);
            const decision = decisionLine.trim();

            res.json({
                gainNet: gainNet,
                decision: decision
            });

        } catch (parseError) {
             console.error(`Erreur de parsing: ${parseError.message}`);
             res.status(500).json({ error: "Impossible d'interpréter la réponse du modèle.", details: stdout });
        }
    });
});


app.listen(PORT, () => {
    console.log(`Backend proxy et serveur de prédiction démarrés sur http://localhost:${PORT}`);
});