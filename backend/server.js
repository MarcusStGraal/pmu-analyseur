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

    if (!strategie || !cotes || !indices_forme || !gains_par_course) {
        return res.status(400).json({ error: 'Données manquantes pour la prédiction.' });
    }

   const pythonExecutable = '/opt/venv/bin/python'; 
    const scriptPath = path.join(__dirname, 'predict_dutching.py');

    const args = [
        scriptPath,
        '-s', strategie.toString(),
        '-c', ...cotes.map(c => c.toString()),
        '-i', ...indices_forme.map(i => i.toString()),
        '-g', ...gains_par_course.map(g => g.toString())
    ];

    const { spawn } = require('child_process');
    const pythonProcess = spawn(pythonExecutable, args);

    let stdout_data = '';
    let stderr_data = '';

    pythonProcess.stdout.on('data', (data) => {
        stdout_data += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        stderr_data += data.toString();
    });

    pythonProcess.on('close', (code) => {
        // Logguer TOUT ce qu'on a reçu
        console.log(`--- Python Process Finished ---`);
        console.log(`Exit Code: ${code}`);
        console.log(`STDOUT:\n${stdout_data}`);
        console.error(`STDERR:\n${stderr_data}`);
        console.log(`-----------------------------`);

        if (code !== 0) {
            return res.status(500).json({ 
                error: "Le script Python a échoué.", 
                details: stderr_data || `Le script s'est terminé avec le code d'erreur ${code}.`
            });
        }

        try {
            const lines = stdout_data.trim().split('\n');
            const gainLine = lines.find(line => line.includes('Prédiction du Gain Net'));
            const decisionLine = lines.find(line => line.startsWith('✅') || line.startsWith('❌'));
            
            if (!gainLine || !decisionLine) {
                throw new Error('Format de sortie du script inattendu.');
            }
            
            const gainMatch = gainLine.match(/([+-]?\d+\.?\d*)/);
            const gainNet = parseFloat(gainMatch[1]);
            const decision = decisionLine.trim();

            res.json({ gainNet, decision });

        } catch (parseError) {
             res.status(500).json({ 
                error: "Impossible d'interpréter la réponse du modèle.", 
                details: parseError.message,
                stdout: stdout_data
            });
        }
    });

    pythonProcess.on('error', (err) => {
        console.error("Erreur de lancement du processus Python:", err);
        res.status(500).json({ 
            error: "Impossible de lancer le script Python.", 
            details: err.message 
        });
    });
});


app.listen(PORT, () => {
    console.log(`Backend proxy et serveur de prédiction démarrés sur http://localhost:${PORT}`);
});