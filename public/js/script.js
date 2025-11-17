// Configuración de la API (se carga desde config.js)
// Si config.js no está cargado, usar fallback
const API_BASE_URL = window.API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api');

// Elementos del DOM
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const messageContainer = document.getElementById('messageContainer');

// Elementos de login
const loginButton = document.getElementById('loginButton');
const loginLoader = document.getElementById('buttonLoader');

// Elementos de registro
const registerButton = document.getElementById('registerButton');
const registerLoader = document.getElementById('registerLoader');

// Funciones de utilidad
function showMessage(message, type = 'info') {
    messageContainer.innerHTML = `<div class="message ${type}">${message}</div>`;
    setTimeout(() => {
        messageContainer.innerHTML = '';
    }, 5000);
}

function setLoading(button, loader, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

function clearErrors(form) {
    const errorElements = form.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.textContent = '';
    });
    
    const inputElements = form.querySelectorAll('input');
    inputElements.forEach(input => {
        input.classList.remove('error');
    });
}

function showError(inputId, message) {
    const input = document.getElementById(inputId);
    const errorElement = document.getElementById(inputId + 'Error');
    
    if (input) input.classList.add('error');
    if (errorElement) errorElement.textContent = message;
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    return password.length >= 6;
}

// Funciones de autenticación
async function loginUser(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            // Guardar tokens en localStorage
            localStorage.setItem('token', data.data.accessToken);
            localStorage.setItem('refreshToken', data.data.refreshToken);
            localStorage.setItem('user', JSON.stringify(data.data.user));
            
            showMessage('¡Login exitoso! Redirigiendo...', 'success');
            
            // Simular redirección (aquí podrías redirigir a otra página)
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);
        } else {
            showMessage(data.message || 'Error en el login', 'error');
        }
    } catch (error) {
        console.error('Error en login:', error);
        showMessage('Error de conexión. Intenta nuevamente.', 'error');
    }
}

async function registerUser(name, email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (data.success) {
            // Guardar tokens en localStorage
            localStorage.setItem('token', data.data.accessToken);
            localStorage.setItem('refreshToken', data.data.refreshToken);
            localStorage.setItem('user', JSON.stringify(data.data.user));
            
            showMessage('¡Registro exitoso! Redirigiendo...', 'success');
            
            // Simular redirección
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);
        } else {
            showMessage(data.message || 'Error en el registro', 'error');
        }
    } catch (error) {
        console.error('Error en registro:', error);
        showMessage('Error de conexión. Intenta nuevamente.', 'error');
    }
}

// Event Listeners
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(loginForm);
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    // Validaciones frontend
    let hasErrors = false;
    
    if (!email) {
        showError('email', 'El email es requerido');
        hasErrors = true;
    } else if (!validateEmail(email)) {
        showError('email', 'Ingresa un email válido');
        hasErrors = true;
    }
    
    if (!password) {
        showError('password', 'La contraseña es requerida');
        hasErrors = true;
    }
    
    if (hasErrors) return;
    
    setLoading(loginButton, loginLoader, true);
    
    try {
        await loginUser(email, password);
    } finally {
        setLoading(loginButton, loginLoader, false);
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(registerForm);
    
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validaciones frontend
    let hasErrors = false;
    
    if (!name) {
        showError('regName', 'El nombre es requerido');
        hasErrors = true;
    } else if (name.length < 2) {
        showError('regName', 'El nombre debe tener al menos 2 caracteres');
        hasErrors = true;
    }
    
    if (!email) {
        showError('regEmail', 'El email es requerido');
        hasErrors = true;
    } else if (!validateEmail(email)) {
        showError('regEmail', 'Ingresa un email válido');
        hasErrors = true;
    }
    
    if (!password) {
        showError('regPassword', 'La contraseña es requerida');
        hasErrors = true;
    } else if (!validatePassword(password)) {
        showError('regPassword', 'La contraseña debe tener al menos 6 caracteres');
        hasErrors = true;
    }
    
    if (!confirmPassword) {
        showError('confirmPassword', 'Confirma tu contraseña');
        hasErrors = true;
    } else if (password !== confirmPassword) {
        showError('confirmPassword', 'Las contraseñas no coinciden');
        hasErrors = true;
    }
    
    if (hasErrors) return;
    
    setLoading(registerButton, registerLoader, true);
    
    try {
        await registerUser(name, email, password);
    } finally {
        setLoading(registerButton, registerLoader, false);
    }
});

// Toggle entre formularios
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    clearErrors(loginForm);
    messageContainer.innerHTML = '';
    
    // Actualizar título y subtítulo
    document.querySelector('.login-header h1').textContent = 'Crear Cuenta';
    document.querySelector('.login-header p').textContent = 'Únete a nuestra comunidad y comienza tu viaje hacia el éxito';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    clearErrors(registerForm);
    messageContainer.innerHTML = '';
    
    // Restaurar título y subtítulo original
    document.querySelector('.login-header h1').textContent = 'Iniciar Sesión';
    document.querySelector('.login-header p').textContent = 'Ingresa tus credenciales para acceder al sistema';
});

// Toggle de visibilidad de contraseñas
document.getElementById('togglePassword').addEventListener('click', () => {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('toggleIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    } else {
        passwordInput.type = 'password';
        toggleIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    }
});

document.getElementById('toggleRegPassword').addEventListener('click', () => {
    const passwordInput = document.getElementById('regPassword');
    const toggleIcon = document.getElementById('toggleRegIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    } else {
        passwordInput.type = 'password';
        toggleIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    }
});

// Función para manejar refresh token
async function refreshTokenIfNeeded() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken })
        });
        
        const data = await response.json();
        if (data.success) {
            localStorage.setItem('token', data.data.accessToken);
            localStorage.setItem('refreshToken', data.data.refreshToken);
            localStorage.setItem('user', JSON.stringify(data.data.user));
            return true;
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
    }
    
    return false;
}

// Verificar si el usuario ya está autenticado
window.addEventListener('load', async () => {
    const token = localStorage.getItem('token');
    if (token) {
        // Verificar si el token es válido
        fetch(`${API_BASE_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.status === 401) {
                // Token expirado, intentar refresh
                return refreshTokenIfNeeded();
            }
            return response.json();
        })
        .then(data => {
            if (data === true) {
                // Token refrescado exitosamente, redirigir
                window.location.href = '/dashboard';
            } else if (data && data.success) {
                // Usuario autenticado, redirigir
                window.location.href = '/dashboard';
            } else {
                // Token inválido, limpiar localStorage
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
            }
        })
        .catch(() => {
            // Error de conexión, limpiar localStorage
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
        });
    }
});

// Función de logout global
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/home';
}

window.logout = logout;
