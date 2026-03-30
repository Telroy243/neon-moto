// --- SYSTÈME GLOBALE DE DEVISE (USD/CDF) ---
let neonDeviseGlobale = "USD";
let neonTauxGlobal = 2500;

async function loadNeonCurrency() {
    neonDeviseGlobale = await dbGetConfig('pref_devise') || "USD";
    neonTauxGlobal = parseFloat(await dbGetConfig('taux_change')) || 2500;
}

function formatMoney(amountUSD) {
    if (neonDeviseGlobale === "CDF") {
        return (amountUSD * neonTauxGlobal).toLocaleString('fr-FR') + " FC";
    }
    return amountUSD.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}
// ------------------------------------------

// --- SYSTÈME D'ALERTES NEON (Remplace \`alert()\`) ---
window.alert = function(message, type = "info") {
    let container = document.getElementById("neon-toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "neon-toast-container";
        container.style.position = "fixed";
        container.style.top = "20px";
        container.style.left = "50%";
        container.style.transform = "translateX(-50%)";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "10px";
        container.style.zIndex = "999999";
        container.style.pointerEvents = "none";
        document.body.appendChild(container);

        const style = document.createElement("style");
        style.innerHTML = `
            @keyframes slideDownNeon {
                0% { transform: translateY(-50px); opacity: 0; }
                10% { transform: translateY(0); opacity: 1; }
                90% { transform: translateY(0); opacity: 1; }
                100% { transform: translateY(-20px); opacity: 0; }
            }
            .neon-toast {
                background: #1a1a1a;
                border: 1px solid #333;
                color: #fff;
                padding: 12px 24px;
                border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.9);
                font-family: 'Segoe UI', Roboto, sans-serif;
                font-size: 0.95rem;
                font-weight: bold;
                text-align: center;
                animation: slideDownNeon 3.5s ease-in-out forwards;
                max-width: 90vw;
                pointer-events: auto;
            }
            .neon-toast.success { border-bottom: 3px solid #00ffcc; color: #00ffcc; }
            .neon-toast.error { border-bottom: 3px solid #ff3366; color: #ff3366; }
            .neon-toast.info { border-bottom: 3px solid #0088ff; color: #0088ff; }
            .neon-toast.warning { border-bottom: 3px solid #ffaa00; color: #ffaa00; }
        `;
        document.head.appendChild(style);
    }

    if (type === "info") {
        const msgLower = message.toString().toLowerCase();
        if (msgLower.includes("erreur") || msgLower.includes("impossible") || msgLower.includes("échec") || msgLower.includes("attention") || msgLower.includes("incorrect") || msgLower.includes("invalide") || msgLower.includes("obligatoires")) type = "error";
        if (msgLower.includes("succès") || msgLower.includes("réussie") || msgLower.includes("✅") || msgLower.includes("🎉")) type = "success";
        if (msgLower.includes("⚠️")) type = "warning";
    }

    const toast = document.createElement("div");
    toast.className = `neon-toast ${type}`;
    toast.innerHTML = message.toString().replace(/\\n/g, "<br>").replace(/\n/g, "<br>");
    
    container.appendChild(toast);

    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3500);
};
// ----------------------------------------------------

// CONFIGURATION GLOBALE
const DB_NAME = "NeonFleetDB";
const DB_VERSION = 2; // Incremented to trigger onupgradeneeded for new tables
let db;

// 1. INITIALISATION DE LA BASE DE DONNÉES
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            // Création des tables (Stores) avec leurs index
            if (!db.objectStoreNames.contains("motos")) {
                const s = db.createObjectStore("motos", { keyPath: "id" });
                s.createIndex("statut", "statut", { unique: false });
            }
            if (!db.objectStoreNames.contains("motards")) {
                db.createObjectStore("motards", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("transactions")) {
                const s = db.createObjectStore("transactions", { keyPath: "id" });
                s.createIndex("moto_id", "moto_id", { unique: false });
                s.createIndex("date", "date_timestamp", { unique: false });
            }
            if (!db.objectStoreNames.contains("incidents")) {
                const s = db.createObjectStore("incidents", { keyPath: "id" });
                s.createIndex("moto_id", "moto_id", { unique: false });
            }
            if (!db.objectStoreNames.contains("config")) {
                db.createObjectStore("config", { keyPath: "id" });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(true);
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

// 2. SÉCURITÉ (GESTION DU PIN)
function getStoredPin() {
    return new Promise((resolve) => {
        const trans = db.transaction("config", "readonly");
        const req = trans.objectStore("config").get("user_pin");
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => resolve(null);
    });
}

function savePin(newPin) {
    return new Promise((resolve) => {
        const trans = db.transaction("config", "readwrite");
        trans.objectStore("config").put({ id: "user_pin", value: newPin });
        trans.oncomplete = () => resolve(true);
    });
}

function resetApp() {
    const trans = db.transaction("config", "readwrite");
    trans.objectStore("config").delete("user_pin");
    alert("Système réinitialisé. Redirection vers l'accueil.");
    setTimeout(() => { window.location.href = "index.html"; }, 1500);
}

// 3. GESTION DU GARAGE (MOTOS)
function dbSaveMoto(moto) {
    return new Promise((resolve, reject) => {
        const trans = db.transaction("motos", "readwrite");
        const req = trans.objectStore("motos").put(moto);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject("Erreur d'enregistrement de la moto");
    });
}

function dbGetAllMotos() {
    return new Promise((resolve) => {
        const trans = db.transaction("motos", "readonly");
        const req = trans.objectStore("motos").getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve([]);
    });
}

function dbSaveMotard(motard) {
    return new Promise((resolve, reject) => {
        const trans = db.transaction("motards", "readwrite");
        const req = trans.objectStore("motards").put(motard);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject("Erreur d'enregistrement du motard");
    });
}

function dbGetAllMotards() {
    return new Promise((resolve) => {
        const trans = db.transaction("motards", "readonly");
        const req = trans.objectStore("motards").getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve([]);
    });
}

// 4. GESTION DES PARAMÈTRES (CONFIG OBJECTIFS & TAUX)
function dbSaveConfig(key, value) {
    return new Promise((resolve, reject) => {
        const trans = db.transaction("config", "readwrite");
        const req = trans.objectStore("config").put({ id: key, value: value });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject("Erreur de sauvegarde config");
    });
}

function dbGetConfig(key) {
    return new Promise((resolve) => {
        const trans = db.transaction("config", "readonly");
        const req = trans.objectStore("config").get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => resolve(null);
    });
}

// 5. GESTION DE LA TRÉSORERIE (TRANSACTIONS)
function dbSaveTransaction(transactionObj) {
    return new Promise((resolve, reject) => {
        const trans = db.transaction("transactions", "readwrite");
        const req = trans.objectStore("transactions").put(transactionObj);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject("Erreur d'enregistrement de la transaction");
    });
}

function dbGetAllTransactions() {
    return new Promise((resolve) => {
        const trans = db.transaction("transactions", "readonly");
        const req = trans.objectStore("transactions").getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve([]);
    });
}