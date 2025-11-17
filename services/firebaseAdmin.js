const admin = require('firebase-admin');

let firebaseInitialized = false;

function initializeFirebaseAdmin() {
    if (firebaseInitialized) {
        return;
    }

    const databaseURL = process.env.FIREBASE_DATABASE_URL;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (!databaseURL) {
        throw new Error('FIREBASE_DATABASE_URL no está definido en las variables de entorno.');
    }

    let credential;

    if (serviceAccountJson) {
        try {
            const parsed = JSON.parse(serviceAccountJson);
            credential = admin.credential.cert(parsed);
        } catch (error) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no contiene un JSON válido.');
        }
    } else if (serviceAccountPath) {
        try {
            // eslint-disable-next-line global-require, import/no-dynamic-require
            const serviceAccount = require(serviceAccountPath);
            credential = admin.credential.cert(serviceAccount);
        } catch (error) {
            throw new Error(`No se pudo cargar el archivo de credenciales en FIREBASE_SERVICE_ACCOUNT_PATH (${serviceAccountPath}).`);
        }
    } else {
        throw new Error('Debes definir FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_SERVICE_ACCOUNT_PATH en las variables de entorno.');
    }

    admin.initializeApp({
        credential,
        databaseURL
    });

    firebaseInitialized = true;
}

async function getFirebaseUsers(existingEmails = new Set()) {
    initializeFirebaseAdmin();

    const snapshot = await admin.database().ref('users').once('value');
    const usersData = snapshot.val() || {};
    const firebaseUsers = [];

    Object.entries(usersData).forEach(([uid, userData]) => {
        if (!userData) return;

        const email = typeof userData.email === 'string' ? userData.email.trim() : '';
        if (!email || existingEmails.has(email.toLowerCase())) {
            return;
        }

        const name =
            userData.displayName ||
            userData.fullName ||
            userData.name ||
            'Usuario Firebase';

        const createdAtSource =
            userData.createdAt ||
            userData.created_at ||
            userData.created_at_ms ||
            Date.now();

        const createdAt = new Date(createdAtSource);

        // Intentar obtener la contraseña de Firebase
        // Si existe un campo password, usarlo; si no, usar una contraseña por defecto
        // Nota: Firebase puede tener passwordHash (SHA-256) que no es compatible con bcrypt
        const password = userData.password || userData.pass || null;
        const passwordHash = userData.passwordHash || null;
        const pinHash = userData.pinHash || null;

        firebaseUsers.push({
            id: `fb-${uid}`,
            displayId: `FB-${uid.slice(-6).toUpperCase()}`,
            firebase_uid: uid,
            name,
            email,
            password, // Contraseña en texto plano o bcrypt (si existe)
            passwordHash, // Hash SHA-256 de Firebase (no compatible con bcrypt)
            pinHash, // Hash del PIN (no compatible con bcrypt)
            role: 'estudiante',
            parent_id: userData.parent_id || null,
            created_at: createdAt.toISOString(),
            last_login: userData.lastLoginAt || userData.last_login || null,
            source: 'firebase',
            raw: userData
        });
    });

    return firebaseUsers;
}

function normalizeGestureAttempts(rawAttempts = {}) {
    const attempts = [];

    const pushAttempt = (gestureId, attemptId, payload = {}) => {
        if (!payload) return;

        const timestamp =
            payload.timestamp ||
            payload.performedAt ||
            payload.createdAt ||
            payload.date ||
            Date.now();

        let score = payload.percentage ?? payload.score ?? payload.confidence ?? 0;
        if (typeof score === 'string') {
            const parsed = Number(score);
            score = Number.isNaN(parsed) ? 0 : parsed;
        }
        if (typeof score === 'number' && score <= 1) {
            score = Math.round(score * 100);
        }
        score = Math.max(0, Math.min(100, Math.round(score)));

        const signName =
            payload.sign ||
            payload.signName ||
            payload.gestureName ||
            payload.name ||
            gestureId ||
            'Gesto';

        attempts.push({
            id: `${gestureId}::${attemptId}`,
            gestureId,
            sign: signName,
            percentage: score,
            timestamp,
            raw: payload
        });
    };

    Object.entries(rawAttempts).forEach(([gestureId, gesturePayload]) => {
        if (!gesturePayload) return;

        if (Array.isArray(gesturePayload)) {
            gesturePayload.forEach((attempt, index) => {
                pushAttempt(gestureId, index, attempt);
            });
            return;
        }

        const { attempts: nestedAttempts, ...rest } = gesturePayload;

        if (Array.isArray(nestedAttempts)) {
            nestedAttempts.forEach((attempt, index) => {
                pushAttempt(gestureId, index, { ...rest, ...attempt });
            });
            return;
        }

        if (nestedAttempts && typeof nestedAttempts === 'object') {
            Object.entries(nestedAttempts).forEach(([attemptId, attempt]) => {
                pushAttempt(gestureId, attemptId, { ...rest, ...attempt });
            });
            return;
        }

        if (typeof gesturePayload === 'object') {
            pushAttempt(gestureId, 'default', gesturePayload);
        }
    });

    attempts.sort((a, b) => b.timestamp - a.timestamp);
    return attempts;
}

async function getGestureAttemptsForUser(firebaseUid) {
    initializeFirebaseAdmin();

    if (!firebaseUid) {
        return {
            summary: {
                totalAttempts: 0,
                averageScore: 0,
                lastPractice: null,
                bestScore: 0,
                progressPercent: 0
            },
            attempts: []
        };
    }

    const snapshot = await admin.database().ref(`gestureAttempts/${firebaseUid}`).once('value');
    const raw = snapshot.val() || {};
    const attempts = normalizeGestureAttempts(raw);

    const totalAttempts = attempts.length;
    const averageScore = totalAttempts
        ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.percentage || 0), 0) / totalAttempts)
        : 0;
    const bestScore = totalAttempts
        ? Math.max(...attempts.map(attempt => attempt.percentage || 0))
        : 0;
    const lastPractice = totalAttempts ? new Date(attempts[0].timestamp).toISOString() : null;

    return {
        summary: {
            totalAttempts,
            averageScore,
            lastPractice,
            bestScore,
            progressPercent: averageScore
        },
        attempts
    };
}


async function getAllGestureAttempts() {
    initializeFirebaseAdmin();

    const snapshot = await admin.database().ref('gestureAttempts').once('value');
    const data = snapshot.val() || {};

    return Object.entries(data).map(([firebaseUid, attempts]) => ({
        firebase_uid: firebaseUid,
        attempts: normalizeGestureAttempts(attempts)
    }));
}

// Función para sincronizar todos los gesture_attempts de Firebase a MySQL
async function syncAllGestureAttemptsFromFirebase() {
    initializeFirebaseAdmin();
    const GestureAttempt = require('../models/GestureAttempt');

    try {
        console.log('[Sync] Obteniendo datos de gestureAttempts desde Firebase...');
        const snapshot = await admin.database().ref('gestureAttempts').once('value');
        const data = snapshot.val() || {};

        console.log(`[Sync] Encontrados ${Object.keys(data).length} usuarios con gesture_attempts en Firebase`);

        if (Object.keys(data).length === 0) {
            console.warn('[Sync] ⚠️ No hay datos de gestureAttempts en Firebase');
            return {
                totalUsers: 0,
                synced: 0,
                errors: []
            };
        }

        const results = {
            totalUsers: Object.keys(data).length,
            synced: 0,
            errors: []
        };

        for (const [firebaseUid, rawAttempts] of Object.entries(data)) {
            try {
                console.log(`[Sync] Procesando usuario ${firebaseUid}...`);
                console.log(`[Sync] Datos raw:`, JSON.stringify(rawAttempts, null, 2).substring(0, 500));
                
                const attempts = normalizeGestureAttempts(rawAttempts);
                console.log(`[Sync] Attempts normalizados: ${attempts.length}`);
                
                if (attempts.length === 0) {
                    console.log(`[Sync] ⚠️ No se encontraron attempts normalizados para ${firebaseUid}`);
                    continue;
                }
                
                const syncResult = await GestureAttempt.syncFromFirebase(firebaseUid, attempts);
                results.synced += syncResult.synced.length;
                if (syncResult.errors.length > 0) {
                    results.errors.push(...syncResult.errors);
                }
                console.log(`[Sync] ✓ Usuario ${firebaseUid}: ${syncResult.synced.length} attempts sincronizados`);
            } catch (error) {
                console.error(`[Sync] ❌ Error sincronizando attempts para ${firebaseUid}:`, error);
                console.error(`[Sync] Stack:`, error.stack);
                results.errors.push({ firebaseUid, error: error.message, stack: error.stack });
            }
        }

        return results;
    } catch (error) {
        console.error('Error sincronizando gesture_attempts desde Firebase:', error);
        throw error;
    }
}

// Función para sincronizar gesture_attempts de un usuario específico
async function syncGestureAttemptsForUser(firebaseUid) {
    initializeFirebaseAdmin();
    const GestureAttempt = require('../models/GestureAttempt');

    try {
        const snapshot = await admin.database().ref(`gestureAttempts/${firebaseUid}`).once('value');
        const rawAttempts = snapshot.val() || {};
        const attempts = normalizeGestureAttempts(rawAttempts);

        const syncResult = await GestureAttempt.syncFromFirebase(firebaseUid, attempts);
        return syncResult;
    } catch (error) {
        console.error(`Error sincronizando attempts para usuario ${firebaseUid}:`, error);
        throw error;
    }
}

module.exports = {
    getFirebaseUsers,
    getGestureAttemptsForUser,
    getAllGestureAttempts,
    syncAllGestureAttemptsFromFirebase,
    syncGestureAttemptsForUser
};

