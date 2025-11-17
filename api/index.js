// Handler para Vercel Serverless Functions
// Este archivo es el punto de entrada para todas las rutas en Vercel

// Establecer variable de entorno para que server.js sepa que está en Vercel
process.env.VERCEL = '1';

// Cargar y exportar la aplicación Express
const app = require('../server');

module.exports = app;

