// Configuración de la API (se carga desde config.js)
// Si config.js no está cargado, usar fallback
const API_BASE_URL = window.API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api');

// Verificar autenticación al cargar la página
window.addEventListener('load', () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        // No hay token o usuario, redirigir al login
        window.location.href = '/home';
        return;
    }
    
    // Mostrar información del usuario
    try {
        const userData = JSON.parse(user);
        document.getElementById('userName').textContent = userData.name;
        document.getElementById('profileName').textContent = userData.name;
        document.getElementById('profileEmail').textContent = userData.email;
        
        // Mostrar rol con badge
        const roleElement = document.getElementById('profileRole');
        if (roleElement && userData.role) {
            roleElement.textContent = userData.role;
            roleElement.className = `role-badge ${userData.role}`;
        }
        
        // Mostrar botones específicos según el rol
        showRoleSpecificButtons(userData.role);
        
        // Formatear fecha de registro
        if (userData.created_at) {
            const date = new Date(userData.created_at);
            document.getElementById('profileDate').textContent = date.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    } catch (error) {
        console.error('Error al parsear datos del usuario:', error);
        logout();
    }
    
    // Verificar si el token sigue siendo válido
    verifyToken();
});

// Verificar token con el servidor
async function verifyToken() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            // Token inválido, hacer logout
            logout();
        }
    } catch (error) {
        console.error('Error al verificar token:', error);
        // En caso de error de conexión, mantener la sesión local
    }
}

// Cargar perfil del usuario desde el servidor
async function loadUserProfile() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Actualizar información en localStorage
            localStorage.setItem('user', JSON.stringify(data.data.user));
            
            // Actualizar información en la interfaz
            document.getElementById('userName').textContent = data.data.user.name;
            document.getElementById('profileName').textContent = data.data.user.name;
            document.getElementById('profileEmail').textContent = data.data.user.email;
            
            showMessage('Perfil actualizado correctamente', 'success');
        } else {
            showMessage(data.message || 'Error al cargar el perfil', 'error');
        }
    } catch (error) {
        console.error('Error al cargar perfil:', error);
        showMessage('Error de conexión al cargar el perfil', 'error');
    }
}

// Mostrar formulario de cambio de contraseña
function showChangePassword() {
    const newPassword = prompt('Ingresa tu nueva contraseña (mínimo 6 caracteres):');
    
    if (newPassword === null) {
        // Usuario canceló
        return;
    }
    
    if (newPassword.length < 6) {
        showMessage('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    showMessage('Contraseña actualizada correctamente', 'success');
}

// Función de logout
function logout() {
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Redirigir al home
    window.location.href = '/home';
}

// Hacer la función logout disponible globalmente
window.logout = logout;

// Función para mostrar mensajes
function showMessage(message, type = 'info') {
    // Crear elemento de mensaje
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    messageElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;
    
    // Aplicar estilos según el tipo
    switch (type) {
        case 'success':
            messageElement.style.backgroundColor = '#27ae60';
            break;
        case 'error':
            messageElement.style.backgroundColor = '#e74c3c';
            break;
        case 'info':
        default:
            messageElement.style.backgroundColor = '#3498db';
            break;
    }
    
    // Agregar al DOM
    document.body.appendChild(messageElement);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        messageElement.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 300);
    }, 3000);
}

// Agregar estilos CSS para las animaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(style);

// Verificar token periódicamente (cada 5 minutos)
setInterval(verifyToken, 5 * 60 * 1000);

// Función para mostrar botones específicos según el rol
function showRoleSpecificButtons(role) {
    // Ocultar todos los botones de panel primero
    const adminBtn = document.getElementById('adminPanelBtn');
    const professorBtn = document.getElementById('professorPanelBtn');
    const studentBtn = document.getElementById('studentPanelBtn');
    const parentBtn = document.getElementById('parentPanelBtn');
    
    if (adminBtn) adminBtn.style.display = 'none';
    if (professorBtn) professorBtn.style.display = 'none';
    if (studentBtn) studentBtn.style.display = 'none';
    if (parentBtn) parentBtn.style.display = 'none';
    
    // Mostrar el botón correspondiente al rol
    switch (role) {
        case 'admin':
            if (adminBtn) adminBtn.style.display = 'block';
            break;
        case 'profesor':
            if (professorBtn) professorBtn.style.display = 'block';
            break;
        case 'estudiante':
            if (studentBtn) studentBtn.style.display = 'block';
            break;
        case 'padre':
            if (parentBtn) parentBtn.style.display = 'block';
            break;
    }
}

// Funciones para navegar a los paneles específicos
function goToAdminPanel() {
    window.location.href = '/admin';
}

function goToProfessorPanel() {
    window.location.href = '/professor';
}

function goToStudentPanel() {
    window.location.href = '/student';
}

function goToParentPanel() {
    window.location.href = '/parent';
}

// Hacer funciones disponibles globalmente
window.goToAdminPanel = goToAdminPanel;
window.goToProfessorPanel = goToProfessorPanel;
window.goToStudentPanel = goToStudentPanel;
window.goToParentPanel = goToParentPanel;
function closeSignLanguageDetector() {
    const section = document.getElementById('sign-language-section');
    section.style.display = 'none';
    
    // Detener detección si está activa
    if (signDetector && signDetector.isDetecting) {
        stopSignDetection();
    }
}

// Iniciar detección de señas
async function startSignDetection() {
    if (!signDetector) {
        const initialized = await initializeSignDetector();
        if (!initialized) {
            return;
        }
    }
    
    // Obtener modo de detección seleccionado
    const modeRadios = document.querySelectorAll('input[name="detection-mode"]');
    for (const radio of modeRadios) {
        if (radio.checked) {
            currentDetectionMode = radio.value;
            break;
        }
    }
    
    try {
        signDetector.startDetection(currentDetectionMode);
        
        // Actualizar botones
        document.getElementById('start-detection-btn').disabled = true;
        document.getElementById('stop-detection-btn').disabled = false;
        
        // Actualizar estado visual
        updateDetectionBoxState('detecting');
        
        // Mostrar mensaje informativo
        const modeText = currentDetectionMode === 'letters' ? 'letras' : 'números';
        showMessage(`Detección de ${modeText} iniciada. Si no hay cámara disponible, funcionará en modo de prueba.`, 'info');
        
        // Configurar tecla ESPACIO para sugerencias
        document.addEventListener('keydown', handleSpaceKey);
        
    } catch (error) {
        console.error('Error al iniciar detección:', error);
        showMessage('Error al iniciar la detección', 'error');
    }
}

// Detener detección de señas
function stopSignDetection() {
    if (signDetector) {
        signDetector.stopDetection();
        
        // Actualizar botones
        document.getElementById('start-detection-btn').disabled = false;
        document.getElementById('stop-detection-btn').disabled = true;
        
        // Actualizar estado visual
        updateDetectionBoxState('normal');
        
        // Remover listener de tecla ESPACIO
        document.removeEventListener('keydown', handleSpaceKey);
        
        showMessage('Detección detenida', 'info');
    }
}

// Manejar detección de señas
async function handleSignDetection(detection) {
    // Actualizar interfaz
    document.getElementById('current-sign').textContent = detection.sign;
    document.getElementById('confidence-level').textContent = 
        `Confianza: ${(detection.confidence * 100).toFixed(1)}%`;
    
    // Mostrar indicador de modo de prueba
    if (detection.testMode) {
        document.getElementById('confidence-level').textContent += ' (MODO PRUEBA)';
        document.getElementById('confidence-level').style.color = '#ffc107';
    } else {
        document.getElementById('confidence-level').style.color = '#28a745';
    }
    
    // Actualizar estado visual del detector
    updateDetectionBoxState('detected');
    
    // Agregar al historial
    addToDetectionHistory(detection);
    
    // Guardar en servidor
    await saveDetectionToServer(detection);
}

// Manejar errores de detección
function handleSignDetectionError(error) {
    console.error('Error en detección de señas:', error);
    showMessage('Error en la detección de señas', 'error');
}

// Actualizar estado visual del detector
function updateDetectionBoxState(state) {
    const detectionBox = document.querySelector('.detection-box');
    if (!detectionBox) return;
    
    // Remover todas las clases de estado
    detectionBox.classList.remove('no-hand', 'detecting', 'detected');
    
    // Agregar clase según el estado
    switch (state) {
        case 'no-hand':
            detectionBox.classList.add('no-hand');
            break;
        case 'detecting':
            detectionBox.classList.add('detecting');
            break;
        case 'detected':
            detectionBox.classList.add('detected');
            // Volver al estado normal después de 1 segundo
            setTimeout(() => {
                detectionBox.classList.remove('detected');
            }, 1000);
            break;
        default:
            // Estado normal (verde)
            break;
    }
}

// Agregar detección al historial visual
function addToDetectionHistory(detection) {
    const historyList = document.getElementById('detection-history-list');
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
        <span class="sign">${detection.sign}</span>
        <span class="confidence">${(detection.confidence * 100).toFixed(1)}%</span>
        <span class="time">${new Date(detection.timestamp).toLocaleTimeString()}</span>
    `;
    
    // Agregar al inicio de la lista
    historyList.insertBefore(historyItem, historyList.firstChild);
    
    // Mantener máximo 10 elementos
    while (historyList.children.length > 10) {
        historyList.removeChild(historyList.lastChild);
    }
}

// Guardar detección en el servidor
async function saveDetectionToServer(detection) {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE_URL}/sign-language/save-detection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                detectedSign: detection.sign,
                confidence: detection.confidence,
                sessionId: detection.sessionId,
                imageData: detection.imageData,
                deviceInfo: detection.deviceInfo
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            console.error('Error al guardar detección:', data.message);
        }
    } catch (error) {
        console.error('Error al guardar detección en servidor:', error);
    }
}

// Manejar tecla ESPACIO para mostrar sugerencias
function handleSpaceKey(event) {
    if (event.code === 'Space') {
        event.preventDefault();
        showSignSuggestions();
    }
}

// Mostrar sugerencias de señas
function showSignSuggestions() {
    const suggestionsDiv = document.getElementById('sign-suggestions');
    const contentDiv = document.getElementById('suggestion-content');
    
    const suggestions = getSignSuggestions(currentDetectionMode);
    contentDiv.innerHTML = suggestions;
    
    suggestionsDiv.style.display = 'block';
}

// Obtener sugerencias de señas
function getSignSuggestions(mode) {
    const suggestions = {
        letters: {
            'A': 'Mano cerrada con el pulgar hacia arriba',
            'B': 'Mano abierta con los dedos juntos',
            'C': 'Mano en forma de C',
            'D': 'Índice apuntando hacia arriba',
            'E': 'Mano cerrada con los dedos curvados',
            'F': 'Índice y pulgar formando círculo',
            'G': 'Índice apuntando hacia el lado',
            'H': 'Índice y medio extendidos',
            'I': 'Meñique extendido',
            'J': 'Meñique haciendo movimiento de J',
            'K': 'Índice y medio extendidos con pulgar',
            'L': 'Índice y pulgar en L',
            'M': 'Tres dedos cerrados',
            'N': 'Dos dedos cerrados',
            'O': 'Mano en forma de O',
            'P': 'Índice y pulgar en P',
            'Q': 'Índice y pulgar en Q',
            'R': 'Índice y medio cruzados',
            'S': 'Mano cerrada',
            'T': 'Pulgar entre índice y medio',
            'U': 'Índice y medio juntos',
            'V': 'Índice y medio separados',
            'W': 'Tres dedos extendidos',
            'X': 'Índice curvado',
            'Y': 'Meñique y pulgar extendidos',
            'Z': 'Índice haciendo movimiento de Z'
        },
        numbers: {
            '0': 'Mano cerrada',
            '1': 'Índice extendido',
            '2': 'Índice y medio extendidos',
            '3': 'Índice, medio y anular extendidos',
            '4': 'Cuatro dedos extendidos',
            '5': 'Mano abierta',
            '6': 'Pulgar y meñique extendidos',
            '7': 'Pulgar, índice y medio extendidos',
            '8': 'Pulgar, índice, medio y anular extendidos',
            '9': 'Cuatro dedos extendidos con pulgar'
        }
    };
    
    const modeSuggestions = suggestions[mode] || suggestions.letters;
    const randomSigns = Object.keys(modeSuggestions).sort(() => 0.5 - Math.random()).slice(0, 3);
    
    let html = '<div class="suggestions-grid">';
    randomSigns.forEach(sign => {
        html += `
            <div class="suggestion-item">
                <div class="suggestion-sign">${sign}</div>
                <div class="suggestion-description">${modeSuggestions[sign]}</div>
            </div>
        `;
    });
    html += '</div>';
    
    return html;
}

// Ocultar sugerencias
function hideSuggestions() {
    document.getElementById('sign-suggestions').style.display = 'none';
}

// Limpiar recursos al cerrar la página
window.addEventListener('beforeunload', () => {
    if (signDetector) {
        signDetector.cleanup();
    }
});

// Función para mostrar botones específicos según el rol
function showRoleSpecificButtons(role) {
    // Ocultar todos los botones de panel primero
    const adminBtn = document.getElementById('adminPanelBtn');
    const professorBtn = document.getElementById('professorPanelBtn');
    const studentBtn = document.getElementById('studentPanelBtn');
    const parentBtn = document.getElementById('parentPanelBtn');
    
    if (adminBtn) adminBtn.style.display = 'none';
    if (professorBtn) professorBtn.style.display = 'none';
    if (studentBtn) studentBtn.style.display = 'none';
    if (parentBtn) parentBtn.style.display = 'none';
    
    // Mostrar el botón correspondiente al rol
    switch (role) {
        case 'admin':
            if (adminBtn) adminBtn.style.display = 'block';
            break;
        case 'profesor':
            if (professorBtn) professorBtn.style.display = 'block';
            break;
        case 'estudiante':
            if (studentBtn) studentBtn.style.display = 'block';
            break;
        case 'padre':
            if (parentBtn) parentBtn.style.display = 'block';
            break;
    }
}

// Funciones para navegar a los paneles específicos
function goToAdminPanel() {
    window.location.href = '/admin';
}

function goToProfessorPanel() {
    window.location.href = '/professor';
}

function goToStudentPanel() {
    window.location.href = '/student';
}

function goToParentPanel() {
    window.location.href = '/parent';
}
