// Configuración centralizada de la API
// Detecta automáticamente si está en desarrollo o producción

(function() {
    // Detectar el entorno
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname === '';
    
    // Configurar la URL base de la API
    let API_BASE_URL;
    
    if (isDevelopment) {
        // En desarrollo local, usar localhost:5000
        API_BASE_URL = 'http://localhost:5000/api';
    } else {
        // En producción (Vercel u otro hosting), usar la misma URL base
        // Si el backend está en el mismo dominio, usar rutas relativas
        API_BASE_URL = '/api';
        
        // Si el backend está en otro dominio, descomenta y configura:
        // API_BASE_URL = 'https://tu-backend-url.vercel.app/api';
    }
    
    // Exportar la configuración globalmente
    window.API_CONFIG = {
        BASE_URL: API_BASE_URL,
        isDevelopment: isDevelopment
    };
    
    // También exportar directamente para compatibilidad
    window.API_BASE_URL = API_BASE_URL;
    
    console.log('API Config:', {
        BASE_URL: API_BASE_URL,
        isDevelopment: isDevelopment,
        hostname: window.location.hostname
    });
})();

