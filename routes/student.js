const express = require('express');
const User = require('../models/User');
const Evaluation = require('../models/Evaluation');
const GestureAttempt = require('../models/GestureAttempt');
const { authenticateToken, requireStudent } = require('../middleware/auth');
const { syncGestureAttemptsForUser } = require('../services/firebaseAdmin');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Student
 *   description: Endpoints para estudiantes - ver sus propios datos y progreso
 */

// ===== RUTAS DE ESTUDIANTE =====

// Obtener historial de intentos del estudiante desde MySQL
router.get('/my-attempts', authenticateToken, requireStudent, async (req, res) => {
    try {
        const user = req.userData || await User.findById(req.user.id);
        
        // Obtener attempts desde MySQL
        let attempts = [];
        
        if (user.firebase_uid) {
            // Si tiene firebase_uid, buscar por ese
            attempts = await GestureAttempt.findByFirebaseUid(user.firebase_uid);
        } else if (user.id) {
            // Si no tiene firebase_uid, buscar por user_id
            attempts = await GestureAttempt.findByUserId(user.id);
        }

        // Formatear para el frontend
        const formattedAttempts = attempts.map(attempt => ({
            id: `${attempt.gesture_id}::${attempt.attempt_id}`,
            gestureId: attempt.gesture_id,
            sign: attempt.gesture_name,
            percentage: attempt.score,
            score: attempt.score,
            timestamp: new Date(attempt.timestamp).getTime(),
            date: attempt.timestamp,
            raw: attempt.raw_data
        }));

        res.json({
            success: true,
            data: {
                attempts: formattedAttempts
            }
        });
    } catch (error) {
        console.error('Error obteniendo attempts:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener intentos',
            error: error.message
        });
    }
});

// Sincronizar gesture_attempts desde Firebase a MySQL
router.post('/sync-attempts', authenticateToken, requireStudent, async (req, res) => {
    try {
        const user = req.userData || await User.findById(req.user.id);
        
        if (!user.firebase_uid) {
            return res.status(400).json({
                success: false,
                message: 'Usuario no tiene firebase_uid asociado'
            });
        }

        // Sincronizar desde Firebase
        const syncResult = await syncGestureAttemptsForUser(user.firebase_uid);

        res.json({
            success: true,
            message: 'Sincronización completada',
            data: {
                synced: syncResult.synced.length,
                errors: syncResult.errors.length,
                details: syncResult
            }
        });
    } catch (error) {
        console.error('Error sincronizando attempts:', error);
        res.status(500).json({
            success: false,
            message: 'Error al sincronizar intentos',
            error: error.message
        });
    }
});

// Obtener estadísticas del estudiante
router.get('/my-stats', authenticateToken, requireStudent, async (req, res) => {
    res.json({
        success: true,
        data: {
            stats: {
                totalDetections: 0,
                avgConfidence: 0,
                totalSessions: 0,
                signsPracticed: 0,
                signStats: [],
                sessions: []
            }
        }
    });
});

// Obtener sesiones de práctica del estudiante
router.get('/my-sessions', authenticateToken, requireStudent, async (req, res) => {
    res.json({
        success: true,
        data: {
            sessions: []
        }
    });
});

// Obtener progreso del estudiante
router.get('/my-progress', authenticateToken, requireStudent, async (req, res) => {
    res.json({
        success: true,
        data: {
            progress: {
                totalDetections: 0,
                avgConfidence: 0,
                totalSessions: 0,
                signsPracticed: 0,
                overallProgress: 0,
                progressBySign: [],
                teacherEvaluations: []
            }
        }
    });
});

// Obtener evaluaciones del estudiante hechas por profesores
router.get('/my-evaluations', authenticateToken, requireStudent, async (req, res) => {
    try {
        const evaluations = await Evaluation.findByStudent(req.userData.id);
        
        res.json({
            success: true,
            data: {
                evaluations: evaluations,
                total: evaluations.length
            }
        });
    } catch (error) {
        console.error('Error al obtener evaluaciones del estudiante:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Obtener información del padre del estudiante (si tiene uno asignado)
router.get('/my-parent', authenticateToken, requireStudent, async (req, res) => {
    try {
        const parent = await User.getParentByStudent(req.userData.id);
        
        if (!parent) {
            return res.json({
                success: true,
                data: {
                    parent: null,
                    message: 'No tienes un padre asignado'
                }
            });
        }
        
        res.json({
            success: true,
            data: {
                parent: {
                    id: parent.id,
                    name: parent.name,
                    email: parent.email
                }
            }
        });
    } catch (error) {
        console.error('Error al obtener información del padre:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

module.exports = router;
