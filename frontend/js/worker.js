import { applyAllFilters } from './processing.js';

self.onmessage = function(e) {
    const { grille, functions, betType, limit } = e.data;
    try {
        const result = applyAllFilters(grille, functions, betType, limit);
        self.postMessage({ 
            status: 'success', 
            combinations: result.combinations,
            limitReached: result.limitReached
        });
    } catch (error) {
        console.error("Erreur dans le Web Worker:", error);
        self.postMessage({ status: 'error', message: error.message || 'Erreur inconnue lors du calcul.' });
    }
};