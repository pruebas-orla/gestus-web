import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import {
  getDatabase,
  ref,
  child,
  get,
  onValue,
  off
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js';

const firebaseConfig = window.__FIREBASE_CONFIG__;

let app = null;
let database = null;

// Inicializar Firebase inmediatamente
if (!firebaseConfig) {
  console.warn('[Firebase] No se encontró window.__FIREBASE_CONFIG__. Configura las credenciales de Firebase antes de cargar firebase-data.js');
} else {
  try {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    console.log('[Firebase] ✓ Firebase inicializado correctamente');
  } catch (error) {
    console.error('[Firebase] Error inicializando Firebase:', error);
  }
}

const ensureDatabase = () => {
  if (!database) {
    throw new Error('Firebase Database no se ha inicializado. Revisa window.__FIREBASE_CONFIG__.');
  }
  return database;
};

const toArray = (obj) => {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj);
};

const normalizeGestureAttempts = (rawAttempts, options = {}) => {
  const attempts = [];
  if (!rawAttempts) return attempts;

  const { defaultGestureName = 'Gesto', defaultStatus = 'completed' } = options;

  const pushAttempt = (gestureId, attemptId, attemptData = {}) => {
    if (!attemptData) return;
    const timestamp =
      attemptData.timestamp ||
      attemptData.performedAt ||
      attemptData.createdAt ||
      attemptData.date ||
      Date.now();

    let score = attemptData.score;
    if (typeof score === 'number' && score <= 1) {
      score = Math.round(score * 100);
    }
    if (typeof score !== 'number' || Number.isNaN(score)) {
      score = 0;
    } else {
      score = Math.max(0, Math.min(100, Math.round(score)));
    }

    const signName =
      attemptData.sign ||
      attemptData.signName ||
      attemptData.gestureName ||
      attemptData.name ||
      gestureId ||
      defaultGestureName;

    attempts.push({
      id: `${gestureId}::${attemptId}`,
      gestureId,
      sign: signName,
      date: new Date(timestamp).toISOString(),
      score,
      status: attemptData.status || defaultStatus,
      raw: attemptData
    });
  };

  toArray(rawAttempts).forEach(([gestureId, gesturePayload]) => {
    if (!gesturePayload) return;
    const { attempts: nestedAttempts, ...rest } = gesturePayload;

    if (nestedAttempts && Array.isArray(nestedAttempts)) {
      nestedAttempts.forEach((attempt, index) => {
        pushAttempt(gestureId, index, { ...rest, ...attempt });
      });
      return;
    }

    if (nestedAttempts && typeof nestedAttempts === 'object') {
      toArray(nestedAttempts).forEach(([attemptId, attempt]) => {
        pushAttempt(gestureId, attemptId, { ...rest, ...attempt });
      });
      return;
    }

    if (Array.isArray(gesturePayload)) {
      gesturePayload.forEach((attempt, index) => {
        pushAttempt(gestureId, index, attempt);
      });
      return;
    }

    if (typeof gesturePayload === 'object') {
      pushAttempt(gestureId, 'default', gesturePayload);
    }
  });

  attempts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return attempts;
};

const getUsersSnapshot = async () => {
  const db = ensureDatabase();
  const snapshot = await get(ref(db, 'users'));
  return snapshot.exists() ? snapshot.val() : {};
};

const findUserByEmail = async (email) => {
  if (!email) return null;
  const users = await getUsersSnapshot();
  const lower = email.toLowerCase();
  for (const [uid, user] of Object.entries(users)) {
    if (user?.email && user.email.toLowerCase() === lower) {
      return { uid, ...user };
    }
  }
  return null;
};

const getGestureAttempts = async (uid) => {
  if (!uid) return {};
  const db = ensureDatabase();
  const snapshot = await get(child(ref(db, 'gestureAttempts'), uid));
  return snapshot.exists() ? snapshot.val() : {};
};

const subscribeGestureAttempts = (uid, callback) => {
  if (!uid) return () => {};
  const db = ensureDatabase();
  const attemptsRef = ref(db, `gestureAttempts/${uid}`);
  const listener = (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : {});
  };
  onValue(attemptsRef, listener, (error) => {
    console.error(`[Firebase] Error escuchando gestureAttempts/${uid}:`, error);
  });
  return () => off(attemptsRef, 'value', listener);
};

const subscribeUserProfile = (uid, callback) => {
  if (!uid) return () => {};
  const db = ensureDatabase();
  const userRef = ref(db, `users/${uid}`);
  const listener = (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  };
  onValue(userRef, listener, (error) => {
    console.error(`[Firebase] Error escuchando users/${uid}:`, error);
  });
  return () => off(userRef, 'value', listener);
};

const getUsersByRole = async (role) => {
  if (!role) return [];
  const users = await getUsersSnapshot();
  const normalizedRole = role.toLowerCase();
  return Object.entries(users)
    .filter(([, user]) => user?.role?.toLowerCase() === normalizedRole)
    .map(([uid, user]) => ({ uid, ...user }));
};

const getAllUsers = async () => {
  const users = await getUsersSnapshot();
  return Object.entries(users).map(([uid, user]) => ({ uid, ...user }));
};

const getChildrenByParentUid = async (parentUid) => {
  if (!parentUid) return [];
  const users = await getUsersSnapshot();
  return Object.entries(users)
    .filter(([, user]) => user?.parentUid === parentUid || user?.parent_id === parentUid)
    .map(([uid, user]) => ({ uid, ...user }));
};

const getStudentsByProfessorUid = async (professorUid) => {
  if (!professorUid) return [];
  const users = await getUsersSnapshot();
  return Object.entries(users)
    .filter(([, user]) => user?.professorUid === professorUid || user?.assignedProfessor === professorUid)
    .map(([uid, user]) => ({ uid, ...user }));
};

// Crear el servicio de Firebase inmediatamente y marcarlo como listo
window.firebaseDataService = {
  isReady: Boolean(database && app),
  app,
  database,
  findUserByEmail,
  getUsersByRole,
  getAllUsers,
  getGestureAttempts,
  subscribeGestureAttempts,
  subscribeUserProfile,
  normalizeGestureAttempts,
  getChildrenByParentUid,
  getStudentsByProfessorUid
};

// Log para debugging
if (window.firebaseDataService.isReady) {
  console.log('[Firebase] ✓ firebaseDataService está listo y disponible');
} else {
  console.warn('[Firebase] ⚠️ firebaseDataService NO está listo (database o app no inicializados)');
}

// Función global para logout
function logout() {
  if (window.studentPanel?.cleanup) {
    window.studentPanel.cleanup();
  }
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/home';
}

// Hacer la función logout disponible globalmente
window.logout = logout;

