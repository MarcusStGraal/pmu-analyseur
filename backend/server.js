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

    // Construction de la commande - AMÉLIORÉE
    const args = [
        scriptPath,
        '-s', strategie.toString(),
        '-c', ...cotes.map(c => c.toString()),
        '-i', ...indices_forme.map(i => i.toString()),
        '-g', ...gains_par_course.map(g => g.toString())
    ];

    console.log(`Exécution de la commande : ${pythonExecutable} ${args.join(' ')}`);

    // Exécution du script Python avec spawn au lieu d'exec pour une meilleure gestion
    const { spawn } = require('child_process');
    const pythonProcess = spawn(pythonExecutable, args);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Script Python terminé avec le code: ${code}`);
            console.error(`Stderr: ${stderr}`);
            return res.status(500).json({ 
                error: "Erreur lors de l'exécution du script de prédiction.", 
                details: stderr || `Exit code: ${code}` 
            });
        }

        // Parsing de la sortie du script - VERSION AMÉLIORÉE
        try {
            console.log('Sortie du script Python:', stdout);
            
            const lines = stdout.trim().split('\n');
            
            // Recherche plus robuste des lignes importantes
            let gainLine = null;
            let decisionLine = null;
            
            for (const line of lines) {
                if (line.includes('Prédiction du Gain Net') || line.includes('Prediction du Gain Net')) {
                    gainLine = line;
                }
                if (line.startsWith('✅') || line.startsWith('❌') || 
                    line.includes('PARIER') || line.includes('S\'ABSTENIR')) {
                    decisionLine = line;
                }
            }

            if (!gainLine) {
                console.error('Ligne de gain non trouvée dans:', stdout);
                throw new Error('Impossible de trouver la prédiction de gain dans la sortie du script.');
            }
            
            if (!decisionLine) {
                console.error('Ligne de décision non trouvée dans:', stdout);
                throw new Error('Impossible de trouver la décision dans la sortie du script.');
            }
            
            // Extraction du gain avec regex plus robuste
            const gainMatch = gainLine.match(/([+-]?\d+\.?\d*)\s*€/);
            if (!gainMatch) {
                throw new Error('Impossible d\'extraire la valeur de gain de: ' + gainLine);
            }
            
            const gainNet = parseFloat(gainMatch[1]);
            if (isNaN(gainNet)) {
                throw new Error('La valeur de gain extraite n\'est pas un nombre valide: ' + gainMatch[1]);
            }
            
            const decision = decisionLine.trim();

            console.log('Réponse parsée:', { gainNet, decision });

            res.json({
                gainNet: gainNet,
                decision: decision,
                debug: {
                    stdout: stdout,
                    gainLine: gainLine,
                    decisionLine: decisionLine
                }
            });

        } catch (parseError) {
            console.error(`Erreur de parsing: ${parseError.message}`);
            console.error(`Stdout complet: ${stdout}`);
            res.status(500).json({ 
                error: "Impossible d'interpréter la réponse du modèle.", 
                details: parseError.message,
                stdout: stdout
            });
        }
    });

    pythonProcess.on('error', (error) => {
        console.error(`Erreur de processus Python: ${error.message}`);
        res.status(500).json({ 
            error: "Impossible de démarrer le script Python.", 
            details: error.message 
        });
    });
});


app.listen(PORT, () => {
    console.log(`Backend proxy et serveur de prédiction démarrés sur http://localhost:${PORT}`);
});