// js/api.js

function formatDate(date) {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}${month}${year}`;
}

// Fonction générique qui utilise notre propre backend
async function fetchWithProxy(targetUrl) {
    const proxyUrl = `https://pmu-analyseur.onrender.com/proxy?url=${encodeURIComponent(targetUrl)}`;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 secondes

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(proxyUrl);
            if (response.ok) {
                return response.json(); // Succès, on retourne le résultat
            }
            // Si le serveur est en train de démarrer (503) ou a un autre problème temporaire
            if (response.status === 503 || response.status === 502) {
                console.warn(`Tentative ${i + 1} échouée avec le statut ${response.status}. Nouvelle tentative dans ${retryDelay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay)); // On attend
            } else {
                // Pour les autres erreurs (ex: 404), on abandonne tout de suite
                const errorText = await response.text();
                throw new Error(`Erreur serveur (${response.status}): ${errorText}`);
            }
        } catch (error) {
            if (i === maxRetries - 1) { // Si c'est la dernière tentative, on lance l'erreur
                throw error;
            }
            console.warn(`Tentative ${i + 1} a échoué (erreur réseau). Nouvelle tentative...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    // Si toutes les tentatives échouent
    throw new Error('Impossible de contacter le serveur après plusieurs tentatives.');
}

export async function handleLoadProgram(selectedDate) {
    if (!selectedDate) return null;
    const dateStr = formatDate(selectedDate);
    const programUrl = `https://offline.turfinfo.api.pmu.fr/rest/client/7/programme/${dateStr}`;

    try {
        // L'appel n'a pas besoin de changer, seule fetchWithProxy a été modifiée
        const programmeData = await fetchWithProxy(programUrl);
        if (!programmeData.programme || !Array.isArray(programmeData.programme.reunions)) {
            throw new Error("Aucune réunion trouvée pour cette date.");
        }
        return programmeData;
    } catch (error) {
        console.error(`Erreur de chargement du programme: ${error.message}`);
        return null;
    }
}

export async function fetchParticipants(dateStr, reunionId, courseId) {
    const participantsUrl = `https://offline.turfinfo.api.pmu.fr/rest/client/7/programme/${dateStr}/${reunionId}/${courseId}/participants`;
    try {
        return await fetchWithProxy(participantsUrl);
    } catch (error) {
        console.error(`Erreur de chargement des partants: ${error.message}`);
        return null;
    }
}

export async function fetchDetailedPerformances(dateStr, reunionId, courseId) {
    const perfUrl = `https://offline.turfinfo.api.pmu.fr/rest/client/61/programme/${dateStr}/${reunionId}/${courseId}/performances-detaillees/pretty`;
    try {
        return await fetchWithProxy(perfUrl);
    } catch (error) {
        console.info(`Info performances: Performances détaillées non disponibles (${error.message})`);
        return null;
    }
}