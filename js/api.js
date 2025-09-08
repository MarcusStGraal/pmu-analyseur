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
    // NOUVEAU : On contacte notre propre backend sur le port 3001
    const proxyUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl);
    
    // On n'a plus besoin de manipuler data.contents, la réponse est directe.
    if (!response.ok) {
        // L'erreur vient soit de notre backend, soit de l'API PMU.
        // On construit un message d'erreur plus clair
        const errorText = await response.text();
        throw new Error(`Impossible de charger les partants (${response.status})`);
    }
    
    // On retourne directement la réponse parsée en JSON
    return response.json();
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