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
                    timestamp,
                    raw_data ? JSON.stringify(raw_data) : null
                ]
            );

            // Obtener el registro insertado o actualizado
            let id = result.insertId;
            if (!id || id === 0) {
                // Si fue un UPDATE, obtener el ID del registro existente
                const [idRows] = await pool.execute(
                    `SELECT id FROM gesture_attempts 
                     WHERE firebase_uid = ? AND gesture_id = ? AND attempt_id = ?`,
                    [firebase_uid, gesture_id, attempt_id]
                );
                if (idRows.length > 0) {
                    id = idRows[0].id;
                }
            }

            const [rows] = await pool.execute(
                `SELECT * FROM gesture_attempts WHERE id = ?`,
                [id]
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

        for (const attempt of attempts) {
            try {
                const attemptData = {
                    firebase_uid: firebaseUid,
                    user_id: user_id,
                    gesture_id: attempt.gestureId || attempt.id?.split('::')[0] || 'unknown',
                    attempt_id: attempt.id?.split('::')[1] || attempt.attemptId || 'default',
                    gesture_name: attempt.sign || attempt.gestureName || attempt.gesture_id || 'Gesto',
                    score: attempt.percentage || attempt.score || 0,
                    timestamp: attempt.timestamp ? new Date(attempt.timestamp) : new Date(),
                    raw_data: attempt.raw || attempt
                };

                const saved = await GestureAttempt.create(attemptData);
                synced.push(saved);
            } catch (error) {
                console.error(`Error sincronizando attempt ${attempt.id}:`, error.message);
                errors.push({ attempt: attempt.id, error: error.message });
            }
        }

        return { synced, errors };
    }
}

module.exports = GestureAttempt;

