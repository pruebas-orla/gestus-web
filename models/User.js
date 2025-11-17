const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getConnection } = require('../config/database');

class User {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.email = data.email;
        this.password = data.password;
        this.firebase_uid = data.firebase_uid || null;
        this.role = data.role || 'estudiante'; // admin, profesor, estudiante, padre
        this.parent_id = data.parent_id || null; // Para estudiantes que tienen padre asignado
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    // Crear nuevo usuario
    static async create(userData) {
        try {
            const {
                name,
                email,
                password,
                role = 'estudiante',
                parent_id = null,
                firebase_uid = null
            } = userData;
            const pool = await getConnection();
            
            // Hash de la contraseña con SHA-256 (compatible con Firebase)
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

            const [result] = await pool.execute(`
                INSERT INTO users (name, email, password, role, parent_id, firebase_uid) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, [name, email, hashedPassword, role, parent_id, firebase_uid]);
            
            // Obtener el usuario creado
            const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
            return new User(rows[0]);
        } catch (error) {
            throw error;
        }
    }

    // Buscar usuario por ID
    static async findById(id) {
        try {
            const pool = await getConnection();
            const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
            
            if (rows.length === 0) {
                return null;
            }
            
            return new User(rows[0]);
        } catch (error) {
            throw error;
        }
    }

    // Buscar usuario por email
    static async findByEmail(email) {
        try {
            const pool = await getConnection();
            const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
            
            if (rows.length === 0) {
                return null;
            }
            
            return new User(rows[0]);
        } catch (error) {
            throw error;
        }
    }

    // Obtener todos los usuarios
    static async findAll() {
        try {
            const pool = await getConnection();
            const [rows] = await pool.execute('SELECT * FROM users ORDER BY created_at DESC');
            
            return rows.map(row => new User(row));
        } catch (error) {
            throw error;
        }
    }

    // Verificar contraseña
    async comparePassword(candidatePassword) {
        try {
            // Hashear la contraseña ingresada con SHA-256
            const hashedCandidate = crypto.createHash('sha256').update(candidatePassword).digest('hex');
            // Comparar directamente los hashes
            return hashedCandidate === this.password;
        } catch (error) {
            throw error;
        }
    }

    // Obtener datos públicos del usuario (sin contraseña)
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            firebase_uid: this.firebase_uid,
            role: this.role,
            parent_id: this.parent_id,
            created_at: this.created_at,
        };
    }

    // Actualizar usuario
    async update(updateData) {
        try {
            const { name, email, role, parent_id } = updateData;
            const pool = await getConnection();
            
            await pool.execute(`
                UPDATE users 
                SET name = ?, email = ?, role = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [name, email, role, parent_id, this.id]);
            
            // Obtener el usuario actualizado
            return await User.findById(this.id);
        } catch (error) {
            throw error;
        }
    }

    // Eliminar usuario
    async delete() {
        try {
            const pool = await getConnection();
            await pool.execute('DELETE FROM users WHERE id = ?', [this.id]);
            return true;
        } catch (error) {
            throw error;
        }
    }

    // Métodos específicos para roles

    // Obtener usuarios por rol
    static async findByRole(role) {
        try {
            const pool = await getConnection();
            const [rows] = await pool.execute('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC', [role]);
            return rows.map(row => new User(row));
        } catch (error) {
            throw error;
        }
    }

    // Obtener estudiantes de un padre específico
    static async getStudentsByParent(parentId) {
        try {
            const pool = await getConnection();
            const [rows] = await pool.execute('SELECT * FROM users WHERE parent_id = ? AND role = "estudiante" ORDER BY created_at DESC', [parentId]);
            return rows.map(row => new User(row));
        } catch (error) {
            throw error;
        }
    }

    // Obtener padre de un estudiante
    static async getParentByStudent(studentId) {
        try {
            const pool = await getConnection();
            const [rows] = await pool.execute(`
                SELECT u.* FROM users u 
                INNER JOIN users s ON u.id = s.parent_id 
                WHERE s.id = ? AND u.role = "padre"
            `, [studentId]);
            
            if (rows.length === 0) {
                return null;
            }
            
            return new User(rows[0]);
        } catch (error) {
            throw error;
        }
    }

    // Cambiar rol de usuario (solo admin)
    async changeRole(newRole, parentId = null) {
        try {
            const pool = await getConnection();
            
            await pool.execute(`
                UPDATE users 
                SET role = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [newRole, parentId, this.id]);
            
            // Actualizar el objeto local
            this.role = newRole;
            this.parent_id = parentId;
            
            return await User.findById(this.id);
        } catch (error) {
            throw error;
        }
    }

    // Verificar si el usuario tiene un rol específico
    hasRole(role) {
        return this.role === role;
    }

    // Verificar si es administrador
    isAdmin() {
        return this.role === 'admin';
    }

    // Verificar si es profesor
    isProfessor() {
        return this.role === 'profesor';
    }

    // Verificar si es estudiante
    isStudent() {
        return this.role === 'estudiante';
    }

    // Verificar si es padre
    isParent() {
        return this.role === 'padre';
    }

    // Eliminar usuario
    async delete() {
        const connection = await this.getConnection();
        try {
            const [result] = await connection.execute(
                'DELETE FROM users WHERE id = ?',
                [this.id]
            );
            return result.affectedRows > 0;
        } finally {
            connection.release();
        }
    }

    // Obtener conexión a la base de datos
    async getConnection() {
        const { getConnection } = require('../config/database');
        return await getConnection();
    }
}

module.exports = User;
