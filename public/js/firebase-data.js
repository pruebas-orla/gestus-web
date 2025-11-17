// Panel de Estudiante - JavaScript
class StudentPanel {
    constructor() {
        this.token = localStorage.getItem('token');
        this.userData = null;
        this.practices = [];
        this.evaluations = []; // Evaluaciones del profesor
        this.firebase = {
            service: window.firebaseDataService || null,
            uid: null,
            unsubProfile: null,
            unsubAttempts: null
        };
        
        if (!this.token) {
            window.location.href = '/login';
            return;
        }
        
        this.init();
    }

    async init() {
        try {
            await this.loadUserData();
            
            // Esperar a que firebaseDataService esté disponible
            await this.waitForFirebaseService();
            
            await this.setupFirebaseIntegration();
            this.setupNavigation();
            this.setupEventListeners();
            await this.loadDashboardData();
            
            // 🔄 AUTO-REFRESH: Actualizar gestos en tiempo real cada 5 segundos
            this.startAutoRefresh();
        } catch (error) {
            console.error('Error inicializando panel:', error);
            this.showMessage('Error cargando datos del usuario', 'error');
        }
    }
    
    async waitForFirebaseService(maxAttempts = 10, delay = 500) {
        for (let i = 0; i < maxAttempts; i++) {
            if (window.firebaseDataService?.isReady) {
                console.log('[Firebase] ✓ Servicio de Firebase disponible');
                this.firebase.service = window.firebaseDataService;
                return;
            }
            console.log(`[Firebase] Esperando servicio de Firebase... (intento ${i + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        console.warn('[Firebase] ⚠️ El servicio de Firebase no está disponible después de esperar');
        this.firebase.service = window.firebaseDataService || null;
    }
    
    startAutoRefresh() {
        // Limpiar interval anterior si existe
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Actualizar cada 5 segundos
        this.refreshInterval = setInterval(async () => {
            // Actualización silenciosa (sin mostrar loading)
            await this.loadDashboardData(true); // true = silent
        }, 5000);
        
        console.log('✅ Auto-refresh activado (silencioso): actualizando cada 5 segundos');
    }
    
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('⏸️ Auto-refresh detenido');
        }
    }

    async loadUserData() {
        try {
            const response = await fetch('/api/users/profile', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Error cargando datos del usuario');
            }

            const data = await response.json();
            this.userData = data.data.user;
            
            // Actualizar información del usuario en la interfaz
            document.getElementById('userName').textContent = this.userData.name;
            document.getElementById('profileName').textContent = this.userData.name;
            document.getElementById('profileEmail').textContent = this.userData.email;
            
            // Formatear fecha de registro
            const memberSince = new Date(this.userData.created_at).toLocaleDateString('es-ES');
            document.getElementById('memberSince').textContent = memberSince;

        } catch (error) {
            console.error('Error cargando datos del usuario:', error);
            throw error;
        }
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        const sections = document.querySelectorAll('.content-section');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remover clase active de todos los enlaces y secciones
                navLinks.forEach(l => l.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));
                
                // Agregar clase active al enlace y sección seleccionados
                link.classList.add('active');
                const targetSection = link.getAttribute('data-section');
                document.getElementById(targetSection).classList.add('active');
                
                // Cargar datos específicos de la sección
                this.loadSectionData(targetSection);
            });
        });
    }

    setupEventListeners() {
        // Búsqueda de prácticas
        document.getElementById('practiceSearch').addEventListener('input', (e) => {
            this.filterPractices();
        });

        // Filtro de prácticas
        document.getElementById('practiceFilter').addEventListener('change', (e) => {
            this.filterPractices();
        });
    }

    async loadSectionData(section) {
        switch (section) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'practices':
                await this.loadPractices();
                break;
            case 'profile':
                await this.loadProfile();
                break;
        }
    }

    async loadDashboardData(silent = false) {
        try {
            // Solo mostrar loading si NO es actualización silenciosa
            if (!silent) {
                this.showLoading(true);
            }
            
            // Cargar prácticas de Firebase
            await this.loadPractices();
            
            // Cargar evaluaciones del profesor
            await this.loadEvaluations();
            
            // Actualizar estadísticas del dashboard
            this.updateDashboardStats();
            
        } catch (error) {
            console.error('Error cargando dashboard:', error);
            if (!silent) {
                this.showMessage('Error cargando datos del dashboard', 'error');
            }
        } finally {
            if (!silent) {
                this.showLoading(false);
            }
        }
    }
    
    async loadEvaluations() {
        try {
            const response = await fetch('/api/student/my-evaluations', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                this.evaluations = [];
                return;
            }

            const data = await response.json();
            this.evaluations = data.data?.evaluations || [];
            
            console.log(`[Estudiante] Cargadas ${this.evaluations.length} evaluaciones del profesor`);
            
        } catch (error) {
            console.error('Error cargando evaluaciones:', error);
            this.evaluations = [];
        }
    }

    async loadPractices() {
        try {
            if (this.firebase?.service?.isReady && this.firebase?.uid) {
                // Los datos se actualizan en tiempo real mediante Firebase
                this.renderPracticesTable();
                this.renderRecentPractices();
                this.updateDashboardStats();
                this.updateProfileStats();
                return;
            }

            // Obtener prácticas reales de la API (por ahora estará vacío hasta que se implemente)
            const response = await fetch('/api/student/my-attempts', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                // Si no hay prácticas aún, usar array vacío
                this.practices = [];
            } else {
                const data = await response.json();
                // Mapear datos reales de las prácticas cuando existan
                this.practices = data.data.attempts.map(attempt => ({
                    id: attempt.id,
                    date: attempt.date || attempt.created_at,
                    sign: attempt.sign || 'N/A',
                    score: attempt.score || 0,
                    status: this.getPerformanceStatus(attempt.score || 0)
                }));
            }
            
            this.renderPracticesTable();
            this.renderRecentPractices();
            
        } catch (error) {
            console.error('Error cargando prácticas:', error);
            this.showMessage('Error cargando prácticas', 'error');
            // Si hay error, mostrar lista vacía
            this.practices = [];
            this.renderPracticesTable();
        }
    }
    
    async setupFirebaseIntegration() {
        const service = this.firebase?.service;
        
        console.log('[Firebase] Iniciando integración...');
        console.log('[Firebase] Service ready?', service?.isReady);
        console.log('[Firebase] User email:', this.userData?.email);
        
        if (!service?.isReady) {
            console.warn('[Firebase] Service no está listo');
            return;
        }
        
        if (!this.userData?.email) {
            console.warn('[Firebase] No hay email de usuario');
            return;
        }

        try {
            console.log(`[Firebase] Buscando usuario con email: ${this.userData.email}`);
            const firebaseUser = await service.findUserByEmail(this.userData.email);
            
            if (!firebaseUser) {
                console.warn(`[Firebase] ⚠️ No se encontró un usuario con correo ${this.userData.email}`);
                console.warn(`[Firebase] El usuario debe estar registrado en Firebase Realtime Database`);
                return;
            }

            console.log(`[Firebase] ✓ Usuario encontrado con UID: ${firebaseUser.uid}`);
            this.firebase.uid = firebaseUser.uid;
            this.updateProfileFromFirebase(firebaseUser);

            console.log(`[Firebase] Obteniendo intentos de gestos...`);
            const initialAttempts = service.normalizeGestureAttempts(
                await service.getGestureAttempts(firebaseUser.uid)
            );
            
            console.log(`[Firebase] ✓ Encontrados ${initialAttempts.length} intentos de gestos`);
            this.applyFirebasePractices(initialAttempts);

            this.cleanupFirebaseListeners();
            this.firebase.unsubProfile = service.subscribeUserProfile(firebaseUser.uid, (profile) => {
                if (profile) {
                    this.updateProfileFromFirebase({ uid: firebaseUser.uid, ...profile });
                }
            });
            this.firebase.unsubAttempts = service.subscribeGestureAttempts(firebaseUser.uid, (rawAttempts) => {
                const attempts = service.normalizeGestureAttempts(rawAttempts);
                this.applyFirebasePractices(attempts);
            });
        } catch (error) {
            console.error('Error configurando integración con Firebase:', error);
        }
    }

    cleanupFirebaseListeners() {
        if (this.firebase?.unsubProfile) {
            this.firebase.unsubProfile();
            this.firebase.unsubProfile = null;
        }
        if (this.firebase?.unsubAttempts) {
            this.firebase.unsubAttempts();
            this.firebase.unsubAttempts = null;
        }
    }

    updateProfileFromFirebase(profile) {
        if (!profile) return;
        this.userData.firebaseProfile = profile;

        const name =
            profile.displayName ||
            profile.name ||
            this.userData.name;
        const email = profile.email || this.userData.email;

        const userNameEl = document.getElementById('userName');
        const profileNameEl = document.getElementById('profileName');
        const profileEmailEl = document.getElementById('profileEmail');

        if (userNameEl && name) userNameEl.textContent = name;
        if (profileNameEl && name) profileNameEl.textContent = name;
        if (profileEmailEl && email) profileEmailEl.textContent = email;

        if (profile.memberSince && document.getElementById('memberSince')) {
            const formatted = new Date(profile.memberSince).toLocaleDateString('es-ES');
            document.getElementById('memberSince').textContent = formatted;
        }
    }

    applyFirebasePractices(attempts) {
        if (!Array.isArray(attempts)) {
            this.practices = [];
        } else {
            this.practices = attempts.map((attempt, index) => ({
                id: attempt.id || index,
                gestureId: attempt.gestureId || null,
                date: attempt.date || new Date().toISOString(),
                sign: attempt.sign || 'Gesto',
                score: typeof attempt.score === 'number' ? attempt.score : 0,
                status: this.getPerformanceStatus(typeof attempt.score === 'number' ? attempt.score : 0),
                raw: attempt.raw || null
            }));
            this.practices.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        this.renderPracticesTable();
        this.renderRecentPractices();
        this.updateDashboardStats();
        this.updateProfileStats();
    }

    getPerformanceStatus(score) {
        if (score >= 90) return 'excellent';
        if (score >= 70) return 'good';
        if (score >= 50) return 'fair';
        return 'poor';
    }

    async loadProfile() {
        try {
            // Los datos del perfil ya se cargaron en loadUserData
            // Solo actualizamos las estadísticas específicas del perfil
            this.updateProfileStats();
            
        } catch (error) {
            console.error('Error cargando perfil:', error);
            this.showMessage('Error cargando datos del perfil', 'error');
        }
    }

    updateDashboardStats() {
        console.log('[Dashboard] Actualizando estadísticas...');
        console.log('[Dashboard] Total prácticas:', this.practices.length);
        console.log('[Dashboard] Total evaluaciones:', this.evaluations?.length || 0);
        
        // Total de prácticas desde Firebase
        const totalPractices = this.practices.length;
        document.getElementById('totalPractices').textContent = totalPractices;
        
        // Si hay evaluaciones del profesor, usar ese promedio; si no, usar promedio de prácticas
        let averageScore = 0;
        let bestScore = 0;
        
        if (this.evaluations && this.evaluations.length > 0) {
            // Calcular promedio basado en evaluaciones del profesor
            averageScore = Math.round(this.evaluations.reduce((sum, e) => sum + (e.score || 0), 0) / this.evaluations.length);
            bestScore = Math.max(...this.evaluations.map(e => e.score || 0));
            console.log(`[Dashboard] ✓ Usando promedio de evaluaciones: ${averageScore}% (${this.evaluations.length} evaluaciones)`);
        } else if (this.practices.length > 0) {
            // Si no hay evaluaciones, usar promedio de prácticas
            averageScore = Math.round(this.practices.reduce((sum, p) => sum + p.score, 0) / totalPractices);
            bestScore = Math.max(...this.practices.map(p => p.score));
            console.log(`[Dashboard] ✓ Usando promedio de prácticas: ${averageScore}% (${this.practices.length} prácticas)`);
        } else {
            console.warn('[Dashboard] ⚠️ No hay prácticas ni evaluaciones para mostrar');
        }
        
        const lastPractice = this.practices[0] ? new Date(this.practices[0].date).toLocaleDateString('es-ES') : 'N/A';
        
        document.getElementById('averageScore').textContent = `${averageScore}%`;
        document.getElementById('bestScore').textContent = `${bestScore}%`;
        document.getElementById('lastPractice').textContent = lastPractice;
        
        console.log(`[Dashboard] Estadísticas actualizadas: ${totalPractices} prácticas, promedio ${averageScore}%`);
    }

    renderPracticesTable() {
        const tbody = document.getElementById('practicesTableBody');
        
        if (!this.practices.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-data">
                        <i class="fas fa-hands"></i>
                        <p>No hay prácticas registradas</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.practices.map(practice => `
            <tr>
                <td>${new Date(practice.date).toLocaleDateString('es-ES')}</td>
                <td>${practice.sign}</td>
                <td>
                    <span class="practice-score score-${practice.status}">
                        ${practice.score}%
                    </span>
                </td>
                <td>
                    <span class="status-badge status-${practice.status}">
                        ${this.getStatusText(practice.status)}
                    </span>
                </td>
                <td>
                    <button onclick="studentPanel.viewPractice('${practice.id}')" class="btn btn-sm btn-primary">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderRecentPractices() {
        const container = document.getElementById('recentPracticesList');
        const recentPractices = this.practices.slice(0, 3);
        
        if (!recentPractices.length) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-hands"></i>
                    <p>No hay prácticas recientes</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recentPractices.map(practice => `
            <div class="practice-item">
                <div class="practice-info">
                    <h4>${practice.sign}</h4>
                    <p>${new Date(practice.date).toLocaleDateString('es-ES')}</p>
                </div>
                <div class="practice-score score-${practice.status}">
                    ${practice.score}%
                </div>
            </div>
        `).join('');
    }

    updateProfileStats() {
        if (!this.practices.length) return;
        
        const totalPractices = this.practices.length;
        const averageScore = Math.round(this.practices.reduce((sum, p) => sum + p.score, 0) / totalPractices);
        
        document.getElementById('totalPracticesProfile').textContent = totalPractices;
        document.getElementById('averageScoreProfile').textContent = `${averageScore}%`;
    }

    filterPractices() {
        const searchTerm = document.getElementById('practiceSearch').value.toLowerCase();
        const filterValue = document.getElementById('practiceFilter').value;
        
        let filteredPractices = this.practices;
        
        // Filtrar por búsqueda
        if (searchTerm) {
            filteredPractices = filteredPractices.filter(practice => 
                practice.sign.toLowerCase().includes(searchTerm)
            );
        }
        
        // Filtrar por puntuación
        if (filterValue) {
            filteredPractices = filteredPractices.filter(practice => {
                switch (filterValue) {
                    case 'excellent':
                        return practice.score >= 90;
                    case 'good':
                        return practice.score >= 70 && practice.score < 90;
                    case 'fair':
                        return practice.score >= 50 && practice.score < 70;
                    case 'poor':
                        return practice.score < 50;
                    default:
                        return true;
                }
            });
        }
        
        // Renderizar prácticas filtradas
        this.renderFilteredPractices(filteredPractices);
    }

    renderFilteredPractices(practices) {
        const tbody = document.getElementById('practicesTableBody');
        
        if (!practices.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-data">
                        <i class="fas fa-search"></i>
                        <p>No se encontraron prácticas</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = practices.map(practice => `
            <tr>
                <td>${new Date(practice.date).toLocaleDateString('es-ES')}</td>
                <td>${practice.sign}</td>
                <td>
                    <span class="practice-score score-${practice.status}">
                        ${practice.score}%
                    </span>
                </td>
                <td>
                    <span class="status-badge status-${practice.status}">
                        ${this.getStatusText(practice.status)}
                    </span>
                </td>
                <td>
                    <button onclick="studentPanel.viewPractice('${practice.id}')" class="btn btn-sm btn-primary">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `).join('');
    }

    getStatusText(status) {
        const statusMap = {
            'excellent': 'Excelente',
            'good': 'Buena',
            'fair': 'Regular',
            'poor': 'Necesita mejorar'
        };
        return statusMap[status] || status;
    }

    viewPractice(practiceId) {
        const practice = this.practices.find(p => String(p.id) === String(practiceId));
        if (!practice) return;

        const raw = practice.raw || {};
        const modal = document.getElementById('viewPracticeModal');

        // Fecha
        const formattedDate = practice.date
            ? new Date(practice.date).toLocaleString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'Sin fecha registrada';
        document.getElementById('practiceDetailDate').textContent = formattedDate;

        // Seña
        document.getElementById('practiceDetailSign').textContent = practice.sign || 'Desconocida';

        // Puntaje
        const scoreSpan = document.getElementById('practiceDetailScore');
        scoreSpan.textContent = `${practice.score}%`;
        scoreSpan.className = `score-badge score-${practice.status}`;

        // Estado
        const statusSpan = document.getElementById('practiceDetailStatus');
        statusSpan.textContent = this.getStatusText(practice.status);
        statusSpan.className = `status-badge ${practice.status}`;

        // Confianza / Precisión
        const confidenceValue = raw.confidence ?? raw.percentage ?? null;
        const confidenceText = (() => {
            if (confidenceValue === null || confidenceValue === undefined) return 'No disponible';
            const numeric = Number(confidenceValue);
            if (Number.isNaN(numeric)) return confidenceValue;
            return `${Math.round(numeric * (numeric <= 1 ? 100 : 1))}%`;
        })();
        document.getElementById('practiceDetailConfidence').textContent = confidenceText;

        // Detección (etiqueta detectada)
        const detected = raw.detectedLabel || raw.predictedLabel || raw.label || 'No disponible';
        document.getElementById('practiceDetailDetected').textContent = detected;

        // Identificadores y metadatos
        const tagsContainer = document.getElementById('practiceDetailIds');
        tagsContainer.innerHTML = '';
        const pushTag = (label, value) => {
            if (!value) return;
            const tag = document.createElement('span');
            tag.className = 'detail-tag';
            tag.textContent = `${label}: ${value}`;
            tagsContainer.appendChild(tag);
        };

        const gestureId = raw.gestureId || practice.gestureId || String(practice.id).split('::')[0];
        const attemptId = raw.attemptId || raw.id || practice.id;
        pushTag('Gesto ID', gestureId);
        pushTag('Intento ID', attemptId);
        if (raw.deviceInfo?.model) pushTag('Dispositivo', raw.deviceInfo.model);
        if (raw.deviceInfo?.platform) pushTag('Sistema', raw.deviceInfo.platform);

        // Notas u observaciones
        // Comentarios del profesor (evaluaciones)
        const relatedEvaluation = (this.evaluations || []).find(evaluation => {
            // Comparar por attemptId exacto
            const evalAttemptId = evaluation.attemptId || evaluation.attempt_id || null;
            const practiceAttemptId = raw.attemptId || practice.id;
            if (evalAttemptId && practiceAttemptId && String(evalAttemptId) === String(practiceAttemptId)) {
                return true;
            }

            // Comparar por gestureId si existe
            const evalGestureId = evaluation.gestureId || evaluation.gesture_id || null;
            if (evalGestureId && practice.gestureId && String(evalGestureId) === String(practice.gestureId)) {
                return true;
            }

            // Comparar por gestureName + proximidad temporal (2 horas)
            if (evaluation.gestureName && evaluation.gestureName.toLowerCase() === (practice.sign || '').toLowerCase()) {
                const evalTime = evaluation.attemptTimestamp || evaluation.created_at;
                if (evalTime && practice.date) {
                    const diffMs = Math.abs(new Date(evalTime).getTime() - new Date(practice.date).getTime());
                    if (diffMs <= 1000 * 60 * 60 * 2) { // 2 horas
                        return true;
                    }
                }
            }

            return false;
        });

        const teacherNotes = relatedEvaluation?.comments?.trim();
        document.getElementById('practiceDetailNotes').textContent = teacherNotes || 'Sin comentarios';

        if (!teacherNotes && !relatedEvaluation) {
            console.log(`[Práctica] Sin evaluación del profesor asociada a ${practice.sign} (${practice.id})`);
        }

        modal.style.display = 'block';
    }

    closeViewPracticeModal() {
        const modal = document.getElementById('viewPracticeModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    cleanup() {
        this.cleanupFirebaseListeners();
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }

    showMessage(message, type = 'success') {
        const container = document.getElementById('messageContainer');
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        
        container.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.remove();
        }, 5000);
    }
}

// Función global para logout
function logout() {
    if (window.studentPanel) {
        window.studentPanel.cleanup();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/home';
}

// Hacer la función logout disponible globalmente
window.logout = logout;

// Inicializar el panel cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    window.studentPanel = new StudentPanel();
});
window.addEventListener('beforeunload', () => {
    if (window.studentPanel) {
        window.studentPanel.cleanup();
    }
});