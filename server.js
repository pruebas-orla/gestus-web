const express = require('express');
const cors = require('cors');
const path = require('path');
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

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/professor', professorRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/roles', rolesRoutes);

// Documentación Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rutas para páginas HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'index.html'));
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'home.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'dashboard.html'));
});

app.get('/app-shell', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'app-shell.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'admin.html'));
});

app.get('/professor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'professor.html'));
});

app.get('/student', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'student.html'));
});

app.get('/parent', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'parent.html'));
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

startServer();
