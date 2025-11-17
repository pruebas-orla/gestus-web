const { getConnection } = require('../config/database');

class GestureAttempt {
    constructor(data) {
        this.id = data.id;
        this.firebase_uid = data.firebase_uid;
        this.user_id = data.user_id;
        this.gesture_id = data.gesture_id;
        this.attempt_id = data.attempt_id;
        this.gesture_name = data.gesture_name;
        this.score = Number(data.score);
        this.timestamp = data.timestamp;
        this.raw_data = data.raw_data ? (typeof data.raw_data === 'string' ? JSON.parse(data.raw_data) : data.raw_data) : null;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    toJSON() {
        return {
            id: this.id,
            firebaseUid: this.firebase_uid,
            userId: this.user_id,
            gestureId: this.gesture_id,
            attemptId: this.attempt_id,
            gestureName: this.gesture_name,
            score: this.score,
            timestamp: this.timestamp,
            rawData: this.raw_data,
            createdAt: this.created_at,
            updatedAt: this.updated_at
        };
    }

    static async create(attemptData) {
        const {
            firebase_uid,
            user_id = null,
            gesture_id,
            attempt_id,
            gesture_name,
            score,
            timestamp,
            raw_data = null
        } = attemptData;

        const pool = await getConnection();
        
        try {
            // Asegurar que timestamp sea un objeto Date válido
            const timestampDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
            
            // Formatear timestamp para MySQL (YYYY-MM-DD HH:mm:ss)
            const timestampStr = timestampDate.toISOString().slice(0, 19).replace('T', ' ');
            
            const [result] = await pool.execute(
                `INSERT INTO gesture_attempts 
                    (firebase_uid, user_id, gesture_id, attempt_id, gesture_name, score, timestamp, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    score = VALUES(score),
                    timestamp = VALUES(timestamp),
                    raw_data = VALUES(raw_data),
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    firebase_uid,
                    user_id,
                    gesture_id,
                    attempt_id,
                    gesture_name,
                    score,
                    timestampStr,
                    raw_data ? JSON.stringify(raw_data) : null
                ]
            );

            // Obtener el registro insertado o actualizado
            let id = result.insertId;
            if (!id || id === 0) {
                // Si fue un UPDATE (insertId es 0), obtener el ID del registro existente
                const [idRows] = await pool.execute(
                    `SELECT id FROM gesture_attempts 
                     WHERE firebase_uid = ? AND gesture_id = ? AND attempt_id = ?`,
                    [firebase_uid, gesture_id, attempt_id]
                );
                if (idRows.length > 0) {
                    id = idRows[0].id;
                } else {
                    // Si no se encontró, intentar obtener el último insertado para este usuario
                    const [lastRows] = await pool.execute(
                        `SELECT id FROM gesture_attempts 
                         WHERE firebase_uid = ? 
                         ORDER BY id DESC LIMIT 1`,
                        [firebase_uid]
                    );
                    if (lastRows.length > 0) {
                        id = lastRows[0].id;
                    }
                }
            }

            if (id && id > 0) {
                const [rows] = await pool.execute(
                    `SELECT * FROM gesture_attempts WHERE id = ?`,
                    [id]
                );

                if (rows.length > 0) {
                    return new GestureAttempt(rows[0]);
                }
            }
            
            // Si no se pudo obtener por ID, intentar obtener por los campos únicos
            const [rows] = await pool.execute(
                `SELECT * FROM gesture_attempts 
                 WHERE firebase_uid = ? AND gesture_id = ? AND attempt_id = ?`,
                [firebase_uid, gesture_id, attempt_id]
            );
            
            if (rows.length > 0) {
                return new GestureAttempt(rows[0]);
            }
            
            throw new Error('No se pudo obtener el registro después de insertar');
        } catch (error) {
            // Si es error de duplicado, obtener el registro existente
            if (error.code === 'ER_DUP_ENTRY') {
                const [rows] = await pool.execute(
                    `SELECT * FROM gesture_attempts 
                     WHERE firebase_uid = ? AND gesture_id = ? AND attempt_id = ?`,
                    [firebase_uid, gesture_id, attempt_id]
                );
                if (rows.length > 0) {
                    return new GestureAttempt(rows[0]);
                }
            }
            console.error(`[Sync] Error en GestureAttempt.create:`, error);
            console.error(`[Sync] Datos:`, { firebase_uid, gesture_id, attempt_id, score, timestamp });
            throw error;
        }
    }

    static async findByFirebaseUid(firebaseUid) {
        const pool = await getConnection();
        const [rows] = await pool.execute(
            `SELECT * FROM gesture_attempts 
             WHERE firebase_uid = ? 
             ORDER BY timestamp DESC`,
            [firebaseUid]
        );

        return rows.map(row => new GestureAttempt(row));
    }

    static async findByUserId(userId) {
        const pool = await getConnection();
        const [rows] = await pool.execute(
            `SELECT * FROM gesture_attempts 
             WHERE user_id = ? 
             ORDER BY timestamp DESC`,
            [userId]
        );

        return rows.map(row => new GestureAttempt(row));
    }

    static async findAll() {
        const pool = await getConnection();
        const [rows] = await pool.execute(
            `SELECT * FROM gesture_attempts 
             ORDER BY timestamp DESC`
        );

        return rows.map(row => new GestureAttempt(row));
    }

    static async syncFromFirebase(firebaseUid, attempts) {
        const pool = await getConnection();
        
        // Obtener user_id si existe
        const [userRows] = await pool.execute(
            `SELECT id FROM users WHERE firebase_uid = ? LIMIT 1`,
            [firebaseUid]
        );
        const user_id = userRows.length > 0 ? userRows[0].id : null;

        const synced = [];
        const errors = [];

        console.log(`[Sync] Sincronizando ${attempts.length} attempts para firebase_uid: ${firebaseUid}`);

        for (const attempt of attempts) {
            try {
                // Extraer gesture_id y attempt_id del id si viene en formato "gestureId::attemptId"
                let gesture_id = 'unknown';
                let attempt_id = 'default';
                
                if (attempt.id && typeof attempt.id === 'string' && attempt.id.includes('::')) {
                    const parts = attempt.id.split('::');
                    gesture_id = parts[0] || 'unknown';
                    attempt_id = parts[1] || 'default';
                } else {
                    gesture_id = attempt.gestureId || attempt.gesture_id || 'unknown';
                    attempt_id = attempt.attemptId || attempt.attempt_id || String(Date.now());
                }

                // Normalizar timestamp
                let timestamp = new Date();
                if (attempt.timestamp) {
                    if (typeof attempt.timestamp === 'number') {
                        timestamp = new Date(attempt.timestamp);
                    } else if (typeof attempt.timestamp === 'string') {
                        timestamp = new Date(attempt.timestamp);
                    }
                }

                // Normalizar score
                let score = 0;
                if (attempt.percentage !== undefined) {
                    score = Number(attempt.percentage);
                } else if (attempt.score !== undefined) {
                    score = Number(attempt.score);
                }
                score = Math.max(0, Math.min(100, Math.round(score)));

                const attemptData = {
                    firebase_uid: firebaseUid,
                    user_id: user_id,
                    gesture_id: gesture_id,
                    attempt_id: attempt_id,
                    gesture_name: attempt.sign || attempt.gestureName || attempt.gesture_name || gesture_id || 'Gesto',
                    score: score,
                    timestamp: timestamp,
                    raw_data: attempt.raw || attempt
                };

                const saved = await GestureAttempt.create(attemptData);
                synced.push(saved);
            } catch (error) {
                console.error(`[Sync] Error sincronizando attempt:`, error);
                console.error(`[Sync] Attempt data:`, JSON.stringify(attempt, null, 2));
                errors.push({ 
                    attempt: attempt.id || 'unknown', 
                    error: error.message,
                    stack: error.stack 
                });
            }
        }

        console.log(`[Sync] ✓ Sincronizados ${synced.length}/${attempts.length} attempts para ${firebaseUid}`);
        if (errors.length > 0) {
            console.warn(`[Sync] ⚠️ ${errors.length} errores al sincronizar`);
        }

        return { synced, errors };
    }
}

module.exports = GestureAttempt;

