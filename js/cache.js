// js/cache.js

const DB_NAME = 'PmuAppCache';
const DB_VERSION = 3; // IMPORTANT: Incrémenter la version pour mettre à jour le schéma
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

let dbPromise = null;

function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("Erreur IndexedDB:", event.target.error);
            reject("Erreur d'ouverture de la base de données.");
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('apiResponses')) {
                const apiStore = db.createObjectStore('apiResponses', { keyPath: 'key' });
                apiStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            if (!db.objectStoreNames.contains('filterSets')) {
                db.createObjectStore('filterSets', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('raceNotes')) {
                db.createObjectStore('raceNotes', { keyPath: 'id' });
            }
        };
    });
    return dbPromise;
}

// MODIFIÉ: Accepte le nom de la "table" (store)
export async function get(storeName, key) {
    const db = await openDb();
    return new Promise((resolve) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => {
            resolve(request.result ? request.result.data : null);
        };
        request.onerror = () => resolve(null);
    });
}

// MODIFIÉ: Accepte le nom de la "table" (store)
export async function set(storeName, data) {
    const db = await openDb();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Pour les réponses API, on ajoute un timestamp
    if (storeName === 'apiResponses') {
        const item = {
            key: data.key, // L'objet doit maintenant avoir une propriété `key`
            data: data.data,
            timestamp: new Date().getTime()
        };
        store.put(item);
    } else {
        // Pour les autres stores, on met l'objet directement
        store.put(data);
    }

    return transaction.complete;
}

// NOUVELLE FONCTION: Récupère tous les objets d'une "table"
export async function getAll(storeName) {
    const db = await openDb();
    return new Promise((resolve) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

// NOUVELLE FONCTION: Supprime un objet par sa clé
export async function deleteItem(storeName, key) {
    const db = await openDb();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.delete(key);
    return transaction.complete;
}

// Cette fonction reste spécifique à 'apiResponses'
export async function cleanup() {
    const db = await openDb();
    const transaction = db.transaction('apiResponses', 'readwrite');
    const store = transaction.objectStore('apiResponses');
    const index = store.index('timestamp');
    const threshold = new Date().getTime() - CACHE_EXPIRY_MS;

    const request = index.openCursor(IDBKeyRange.upperBound(threshold));
    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
        }
    };
    return transaction.complete;
}