const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
require('dotenv').config({ path: './config.env' });

const { initializeDatabase, testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const professorRoutes = require('./routes/professor');
const studentRoutes = require('./routes/student');
const parentRoutes = require('./routes/parent');
const rolesRoutes = require('./routes/roles');

const app = express();
// Cloud Run usa la variable PORT automáticamente, pero mantenemos 5000 como fallback para desarrollo local
const PORT = process.env.PORT || 5000;

// Configuración de Swagger
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Sistema Web Gestus API',
            version: '1.0.0',
            description: 'API para el Sistema Web Gestus - Plataforma educativa',
            contact: {
                name: 'Equipo Gestus',
                email: 'info@gestus.com'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Servidor de desarrollo'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'ID único del usuario'
                        },
                        name: {
                            type: 'string',
                            description: 'Nombre completo del usuario'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'Correo electrónico del usuario'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Fecha de creación del usuario'
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Fecha de última actualización'
                        }
                    }
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            description: 'Indica si la operación fue exitosa'
                        },
                        message: {
                            type: 'string',
                            description: 'Mensaje descriptivo de la respuesta'
                        },
                        data: {
                            type: 'object',
                            properties: {
                                user: {
                                    $ref: '#/components/schemas/User'
                                },
                                accessToken: {
                                    type: 'string',
                                    description: 'Token de acceso JWT'
                                },
                                refreshToken: {
                                    type: 'string',
                                    description: 'Token de renovación JWT'
                                }
                            }
                        }
                    }
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        message: {
                            type: 'string',
                            description: 'Mensaje de error'
                        },
                        errors: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    msg: {
                                        type: 'string'
                                    },
                                    param: {
                                        type: 'string'
                                    },
                                    location: {
                                        type: 'string'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        security: [
            {
                bearerAuth: []
            }
        ]
    },
    apis: ['./routes/*.js'] // Archivos que contienen las anotaciones de Swagger
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (debe estar ANTES de las rutas de API)
// Usar process.cwd() para obtener la raíz del proyecto (funciona en Vercel y local)
// __dirname puede variar dependiendo de desde dónde se carga el módulo
const projectRoot = process.cwd();
const publicPath = path.join(projectRoot, 'public');

// Log para debugging (solo en desarrollo)
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL === '1') {
    console.log('Public path:', publicPath);
    console.log('__dirname:', __dirname);
    console.log('process.cwd():', projectRoot);
}

// Servir archivos estáticos desde la raíz de public
app.use(express.static(publicPath, {
    maxAge: '1d', // Cache por 1 día
    etag: true,
    lastModified: true,
    index: false // No servir index.html automáticamente
}));

// Servir archivos estáticos con rutas explícitas para máxima compatibilidad
app.use('/css', express.static(path.join(publicPath, 'css'), {
    maxAge: '1d',
    etag: true
}));
app.use('/js', express.static(path.join(publicPath, 'js'), {
    maxAge: '1d',
    etag: true
}));
app.use('/assets', express.static(path.join(publicPath, 'assets'), {
    maxAge: '7d', // Assets cambian menos frecuentemente
    etag: true,
    setHeaders: (res, path) => {
        // Asegurar que manifest.json tenga los headers correctos
        if (path.endsWith('manifest.json')) {
            res.setHeader('Content-Type', 'application/manifest+json');
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
    }
}));
app.use('/views', express.static(path.join(publicPath, 'views'), {
    maxAge: '1d',
    etag: true
}));

// Ruta explícita para manifest.json (PWA) - debe estar antes de las rutas de API
app.get('/assets/manifest.json', (req, res) => {
    const manifestPath = path.join(publicPath, 'assets', 'manifest.json');
    
    // Verificar que el archivo existe
    if (!fs.existsSync(manifestPath)) {
        console.error('Manifest.json no encontrado en:', manifestPath);
        return res.status(404).json({ error: 'Manifest not found' });
    }
    
    // Establecer headers apropiados para PWA
    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 día
    
    // Enviar el archivo
    res.sendFile(manifestPath, (err) => {
        if (err) {
            console.error('Error al servir manifest.json:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error al cargar manifest' });
            }
        }
    });
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/professor', professorRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/roles', rolesRoutes);

// Documentación Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rutas para páginas HTML (usar publicPath para compatibilidad con Vercel)
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'views', 'index.html'));
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(publicPath, 'views', 'home.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(publicPath, 'views', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(publicPath, 'views', 'dashboard.html'));
});

app.get('/app-shell', (req, res) => {
    res.sendFile(path.join(publicPath, 'views', 'app-shell.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(publicPath, 'views', 'admin.html'));
});

app.get('/professor', (req, res) => {
    res.sendFile(path.join(publicPath, 'views', 'professor.html'));
});

app.get('/student', (req, res) => {
    res.sendFile(path.join(publicPath, 'views', 'student.html'));
});

app.get('/parent', (req, res) => {
    res.sendFile(path.join(publicPath, 'views', 'parent.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor' 
    });
});

// Ruta 404
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Ruta no encontrada' 
    });
});

// Función para sincronizar gesture_attempts desde Firebase (en background)
async function syncGestureAttemptsOnStartup() {
    try {
        const { syncAllGestureAttemptsFromFirebase } = require('./services/firebaseAdmin');
        console.log('[Sync] Iniciando sincronización automática de gesture_attempts desde Firebase...');
        
        const syncResult = await syncAllGestureAttemptsFromFirebase();
        
        console.log(`[Sync] ✓ Sincronización automática completada:`);
        console.log(`[Sync]   - Usuarios procesados: ${syncResult.totalUsers}`);
        console.log(`[Sync]   - Intentos sincronizados: ${syncResult.synced}`);
        if (syncResult.errors.length > 0) {
            console.warn(`[Sync]   - Errores: ${syncResult.errors.length}`);
        }
    } catch (error) {
        console.warn('[Sync] ⚠️ No se pudo sincronizar gesture_attempts al inicio:', error.message);
        console.warn('[Sync]   Esto es normal si Firebase no está configurado o no hay datos');
    }
}

// Inicializar base de datos y iniciar servidor
async function startServer() {
    try {
        console.log('Iniciando servidor...');
        
        // Probar la conexión primero
        const connectionTest = await testConnection();
        if (!connectionTest) {
            throw new Error('No se pudo establecer conexión con la base de datos');
        }
        
        // Inicializar la base de datos
        await initializeDatabase();
        
        // Sincronizar gesture_attempts desde Firebase en background (no bloquea el inicio)
        syncGestureAttemptsOnStartup().catch(err => {
            console.warn('[Sync] Error en sincronización automática:', err.message);
        });
        
        // Iniciar el servidor
        app.listen(PORT, () => {
            console.log('Servidor iniciado exitosamente!');
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
            console.log('Frontend disponible en: http://localhost:5000');
            console.log('Base de datos MySQL conectada');
        });
    } catch (error) {
        console.error('Error al iniciar el servidor:', error.message);
        console.error('Sugerencias para solucionar el problema:');
        console.error('   1. Verificar que XAMPP esté ejecutándose');
        console.error('   2. Verificar que MySQL esté activo en XAMPP');
        console.error('   3. Crear la base de datos "webprojectdb" en phpMyAdmin');
        console.error('   4. Verificar la configuración en config.env');
        process.exit(1);
    }
}

// Para Vercel: exportar la aplicación Express
// Para desarrollo local: iniciar el servidor normalmente
// Vercel establece VERCEL=1 cuando está en su plataforma
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

if (isVercel) {
    // En Vercel/serverless, exportamos la app
    // La inicialización de DB se hará de manera lazy cuando sea necesario
    module.exports = app;
    
    // Intentar inicializar la DB en background (no bloqueante)
    (async () => {
        try {
            await testConnection();
            await initializeDatabase();
            console.log('Base de datos inicializada en Vercel');
        } catch (error) {
            console.warn('No se pudo inicializar la DB al inicio (esto es normal en serverless):', error.message);
        }
    })();
} else {
    // En desarrollo local, iniciamos el servidor normalmente
    startServer();
}
