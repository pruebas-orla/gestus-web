// Panel de Padre - JavaScript
class ParentPanel {
    constructor() {
        this.token = localStorage.getItem('token');
        this.userData = null;
        this.children = [];
        this.practices = [];
        this.charts = {};
        this.firebase = {
            service: window.firebaseDataService || null
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
            this.setupNavigation();
            this.setupEventListeners();
            await this.loadDashboardData();
            
            // 🔄 AUTO-REFRESH: Actualizar datos de los hijos cada 5 segundos
            this.startAutoRefresh();
        } catch (error) {
            console.error('Error inicializando panel:', error);
            this.showMessage('Error cargando datos del usuario', 'error');
        }
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
        // Búsqueda de hijos
        document.getElementById('childSearch').addEventListener('input', (e) => {
            this.filterChildren();
        });

        // Filtro de hijos
        document.getElementById('childFilter').addEventListener('change', (e) => {
            this.filterChildren();
        });
    }

    async loadSectionData(section) {
        switch (section) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'children':
                await this.loadChildren();
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
            
            await this.loadChildren();
            
            // Actualizar estadísticas del dashboard
            this.updateDashboardStats();
            this.renderChildrenOverview();
            
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

    async loadChildren() {
        try {
            const response = await fetch('/api/parent/my-children', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Error cargando hijos');
            }

            const data = await response.json();
            const normalizeAttempts = (attempts = []) => attempts.map((attempt, index) => ({
                id: attempt.id || index,
                date: attempt.timestamp ? new Date(attempt.timestamp).toISOString() : (attempt.date || new Date().toISOString()),
                sign: attempt.sign || 'Gesto',
                score: typeof attempt.percentage === 'number' ? attempt.percentage : 0,
                status: this.getPerformanceStatus(typeof attempt.percentage === 'number' ? attempt.percentage : 0)
            }));

            this.children = data.data.children.map(({ child, stats, attempts }) => {
                const normalizedAttempts = normalizeAttempts(attempts);
                return {
                    id: child.id,
                    firebase_uid: child.firebase_uid,
                    name: child.name,
                    email: child.email,
                    practices: stats.totalAttempts || 0,
                    average: stats.averageScore || 0,
                    lastPractice: stats.lastPractice,
                    progress: this.getPerformanceStatus(stats.averageScore || 0),
                    improvement: `${stats.bestScore || 0}%`,
                    attempts: normalizedAttempts,
                    raw: child
                };
            });

            this.practices = this.children.flatMap(child => child.attempts || []);

            this.renderChildrenTable();
            this.populateSelectors();
            this.updateDashboardStats();
            this.renderChildrenOverview();
        } catch (error) {
            console.error('Error cargando hijos:', error);
            this.showMessage('Error cargando datos de hijos', 'error');
            this.children = [];
            this.practices = [];
            this.renderChildrenTable();
        }
    }

    async loadPractices() {
        try {
            if (this.practices?.length) {
                return;
            }
            this.practices = [];
            
        } catch (error) {
            console.error('Error cargando prácticas:', error);
            this.showMessage('Error cargando prácticas', 'error');
        }
    }

    async loadProgress() {
        try {
            // Crear gráficos de progreso
            this.createChildrenProgressChart();
            this.createTemporalProgressChart();
            
            // Actualizar resumen de progreso
            this.updateProgressSummary();
            
        } catch (error) {
            console.error('Error cargando progreso:', error);
            this.showMessage('Error cargando datos de progreso', 'error');
        }
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
        const totalChildren = this.children.length;
        const totalPractices = this.practices.length;
        const averageScore = totalPractices > 0 
            ? Math.round(this.practices.reduce((sum, p) => sum + p.score, 0) / totalPractices)
            : 0;
        const lastActivity = this.practices.length > 0 
            ? new Date(Math.max(...this.practices.map(p => new Date(p.date)))).toLocaleDateString('es-ES')
            : 'N/A';
        
        document.getElementById('totalChildren').textContent = totalChildren;
        document.getElementById('totalPractices').textContent = totalPractices;
        document.getElementById('averageScore').textContent = totalPractices > 0 ? `${averageScore}%` : 'N/A';
        document.getElementById('lastActivity').textContent = lastActivity;
    }
    
    getPerformanceStatus(score) {
        if (score >= 90) return 'excellent';
        if (score >= 70) return 'good';
        return 'needs-attention';
    }

    renderChildrenTable() {
        const tbody = document.getElementById('childrenTableBody');
        
        if (!this.children.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-data">
                        <i class="fas fa-child"></i>
                        <p>No hay hijos registrados</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.children.map(child => `
            <tr>
                <td>
                    <div class="child-info">
                        <strong>${child.name}</strong>
                    </div>
                </td>
                <td>${child.email}</td>
                <td>${child.practices}</td>
                <td>
                    <span class="score-badge score-${child.progress}">
                        ${child.average}%
                    </span>
                </td>
                <td>${child.lastPractice ? new Date(child.lastPractice).toLocaleDateString('es-ES') : 'N/A'}</td>
                <td>
                    <span class="progress-indicator progress-${child.progress}">
                        ${child.improvement}
                    </span>
                </td>
                <td>
                    <button onclick="parentPanel.viewChildDetails(${child.id})" class="btn btn-sm btn-primary">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderChildrenOverview() {
        const container = document.getElementById('childrenGrid');
        
        if (!this.children.length) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-child"></i>
                    <p>No hay hijos registrados</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.children.map(child => `
            <div class="child-card">
                <h4>
                    <i class="fas fa-child"></i>
                    ${child.name}
                </h4>
                <p>${child.email}</p>
                <div class="child-stats">
                    <div class="child-stat">
                        <div class="value">${child.practices}</div>
                        <div class="label">Prácticas</div>
                    </div>
                    <div class="child-stat">
                        <div class="value">${child.average}%</div>
                        <div class="label">Promedio</div>
                    </div>
                    <div class="child-stat">
                        <div class="value">${child.improvement}</div>
                        <div class="label">Mejora</div>
                    </div>
                    <div class="child-stat">
                        <div class="value">${child.lastPractice ? new Date(child.lastPractice).toLocaleDateString('es-ES') : 'N/A'}</div>
                        <div class="label">Última práctica</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    populateSelectors() {
        const progressChildSelect = document.getElementById('progressChild');
        if (!progressChildSelect) {
            return;
        }

        progressChildSelect.innerHTML = '<option value="">Todos los hijos</option>';

        this.children.forEach(child => {
            const option = document.createElement('option');
            option.value = child.id;
            option.textContent = child.name;
            progressChildSelect.appendChild(option);
        });
    }

    createChildrenProgressChart() {
        const ctx = document.getElementById('childrenProgressChart');
        if (!ctx) return;
        
        // Destruir gráfico existente si existe
        if (this.charts.childrenProgress) {
            this.charts.childrenProgress.destroy();
        }
        
        // Datos de los hijos
        const childrenNames = this.children.map(c => c.name);
        const childrenScores = this.children.map(c => c.average);
        
        this.charts.childrenProgress = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: childrenNames,
                datasets: [{
                    label: 'Puntuación Promedio',
                    data: childrenScores,
                    backgroundColor: 'rgba(142, 68, 173, 0.8)',
                    borderColor: '#8e44ad',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    createTemporalProgressChart() {
        const ctx = document.getElementById('temporalProgressChart');
        if (!ctx) return;
        
        // Destruir gráfico existente si existe
        if (this.charts.temporalProgress) {
            this.charts.temporalProgress.destroy();
        }
        
        const monthlyScores = this.practices.reduce((acc, practice) => {
            if (!practice?.date) return acc;
            const date = new Date(practice.date);
            if (Number.isNaN(date.getTime())) return acc;
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(practice.score || 0);
            return acc;
        }, {});

        const sortedKeys = Object.keys(monthlyScores).sort((a, b) => {
            const [yearA, monthA] = a.split('-').map(Number);
            const [yearB, monthB] = b.split('-').map(Number);
            if (yearA === yearB) return monthA - monthB;
            return yearA - yearB;
        }).slice(-6);

        const formatter = new Intl.DateTimeFormat('es-ES', { month: 'short' });
        const labels = sortedKeys.length
            ? sortedKeys.map(key => {
                const [year, month] = key.split('-').map(Number);
                return formatter.format(new Date(year, month));
            })
            : ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];

        const averageScores = sortedKeys.length
            ? sortedKeys.map(key => {
                const scores = monthlyScores[key];
                return scores.length
                    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
                    : 0;
            })
            : [0, 0, 0, 0, 0, 0];
        
        this.charts.temporalProgress = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Promedio Familiar',
                    data: averageScores,
                    borderColor: '#8e44ad',
                    backgroundColor: 'rgba(142, 68, 173, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    updateProgressSummary() {
        const improvementEl = document.getElementById('averageImprovement');
        const activeDaysEl = document.getElementById('mostActiveDays');
        const practicedSignEl = document.getElementById('mostPracticedSign');

        if (!improvementEl || !activeDaysEl || !practicedSignEl) {
            return;
        }

        const improvements = this.children
            .map(child => {
                const value = parseInt(String(child.improvement || '0').replace('%', ''), 10);
                return Number.isNaN(value) ? 0 : value;
            })
            .filter(value => typeof value === 'number');

        const averageImprovement = improvements.length
            ? Math.round(improvements.reduce((sum, value) => sum + value, 0) / improvements.length)
            : 0;

        const dayFrequency = this.practices.reduce((acc, practice) => {
            if (!practice?.date) return acc;
            const dayKey = new Date(practice.date).toLocaleDateString('es-ES');
            acc[dayKey] = (acc[dayKey] || 0) + 1;
            return acc;
        }, {});
        const mostActiveCount = Object.values(dayFrequency).length
            ? Math.max(...Object.values(dayFrequency))
            : 0;

        const signFrequency = this.practices.reduce((acc, practice) => {
            const key = practice?.sign || 'N/A';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const mostPracticed = Object.entries(signFrequency).length
            ? Object.entries(signFrequency).sort((a, b) => b[1] - a[1])[0][0]
            : 'N/A';

        improvementEl.textContent = `${averageImprovement}%`;
        activeDaysEl.textContent = String(mostActiveCount);
        practicedSignEl.textContent = mostPracticed;
    }

    updateProfileStats() {
        const totalChildren = this.children.length;
        const totalPractices = this.practices.length;
        const averageScore = totalPractices > 0 
            ? Math.round(this.practices.reduce((sum, p) => sum + p.score, 0) / totalPractices)
            : 0;
        
        document.getElementById('totalChildrenProfile').textContent = totalChildren;
        document.getElementById('totalPracticesProfile').textContent = totalPractices;
        document.getElementById('averageScoreProfile').textContent = `${averageScore}%`;
    }

    filterChildren() {
        const searchTerm = document.getElementById('childSearch').value.toLowerCase();
        const filterValue = document.getElementById('childFilter').value;
        
        let filteredChildren = this.children;
        
        // Filtrar por búsqueda
        if (searchTerm) {
            filteredChildren = filteredChildren.filter(child => 
                child.name.toLowerCase().includes(searchTerm) ||
                child.email.toLowerCase().includes(searchTerm)
            );
        }
        
        // Filtrar por progreso
        if (filterValue) {
            filteredChildren = filteredChildren.filter(child => {
                switch (filterValue) {
                    case 'excellent':
                        return child.average >= 90;
                    case 'good':
                        return child.average >= 70 && child.average < 90;
                    case 'needs-attention':
                        return child.average < 70;
                    default:
                        return true;
                }
            });
        }
        
        // Renderizar hijos filtrados
        this.renderFilteredChildren(filteredChildren);
    }

    renderFilteredChildren(children) {
        const tbody = document.getElementById('childrenTableBody');
        
        if (!children.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-data">
                        <i class="fas fa-search"></i>
                        <p>No se encontraron hijos</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = children.map(child => `
            <tr>
                <td>
                    <div class="child-info">
                        <strong>${child.name}</strong>
                    </div>
                </td>
                <td>${child.email}</td>
                <td>${child.practices}</td>
                <td>
                    <span class="score-badge score-${child.progress}">
                        ${child.average}%
                    </span>
                </td>
                <td>${new Date(child.lastPractice).toLocaleDateString('es-ES')}</td>
                <td>
                    <span class="progress-indicator progress-${child.progress}">
                        ${child.improvement}
                    </span>
                </td>
                <td>
                    <button onclick="parentPanel.viewChildDetails(${child.id})" class="btn btn-sm btn-primary">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `).join('');
    }

    updateProgressCharts() {
        // Actualizar gráficos basados en los filtros seleccionados
        this.createChildrenProgressChart();
        this.createTemporalProgressChart();
    }


    // Modal de detalles del hijo
    viewChildDetails(childId) {
        const child = this.children.find(c => c.id === childId);
        if (!child) return;
        
        // Actualizar título del modal
        document.getElementById('childDetailsTitle').textContent = `Detalles de ${child.name}`;
        
        // Crear contenido del modal
        const content = document.getElementById('childDetailsContent');
        content.innerHTML = `
            <div class="child-detail-item">
                <span class="label">Nombre:</span>
                <span class="value">${child.name}</span>
            </div>
            <div class="child-detail-item">
                <span class="label">Email:</span>
                <span class="value">${child.email}</span>
            </div>
            <div class="child-detail-item">
                <span class="label">Prácticas realizadas:</span>
                <span class="value">${child.practices}</span>
            </div>
            <div class="child-detail-item">
                <span class="label">Puntuación promedio:</span>
                <span class="value">${child.average}%</span>
            </div>
            <div class="child-detail-item">
                <span class="label">Última práctica:</span>
                <span class="value">${child.lastPractice ? new Date(child.lastPractice).toLocaleDateString('es-ES') : 'N/A'}</span>
            </div>
            <div class="child-detail-item">
                <span class="label">Mejora:</span>
                <span class="value">${child.improvement}</span>
            </div>
        `;
        
        // Mostrar modal
        document.getElementById('childDetailsModal').style.display = 'block';
    }

    closeChildDetailsModal() {
        document.getElementById('childDetailsModal').style.display = 'none';
    }

    viewChildProgress(childId) {
        const child = this.children.find(c => c.id === childId);
        if (!child) return;
        
        this.showMessage(`Viendo progreso de: ${child.name}`, 'success');
    }

    cleanup() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
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
    if (window.parentPanel?.cleanup) {
        window.parentPanel.cleanup();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/home';
}

// Hacer la función logout disponible globalmente
window.logout = logout;

// Cerrar modal al hacer clic fuera de él
document.addEventListener('click', (e) => {
    const modal = document.getElementById('childDetailsModal');
    if (e.target === modal && window.parentPanel) {
        window.parentPanel.closeChildDetailsModal();
    }
});

// Inicializar el panel cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    window.parentPanel = new ParentPanel();
});
window.addEventListener('beforeunload', () => {
    if (window.parentPanel?.cleanup) {
        window.parentPanel.cleanup();
    }
});