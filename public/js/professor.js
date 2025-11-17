// Panel de Profesor - JavaScript
class ProfessorPanel {
    constructor() {
        this.token = localStorage.getItem('token');
        this.userData = null;
        this.students = [];
        this.evaluations = [];
        this.gestureAttempts = [];
        this.signs = []; // mantenido por compatibilidad, se rellenará con gestureAttempts
        this.charts = {};
        this.currentEvaluationAttempt = null;
        
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
            
            // 🔄 AUTO-REFRESH: Actualizar datos cada 5 segundos
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
        // Búsqueda de estudiantes
        document.getElementById('studentSearch').addEventListener('input', (e) => {
            this.filterStudents();
        });

        // Filtro de estudiantes
        document.getElementById('studentFilter').addEventListener('change', (e) => {
            this.filterStudents();
        });

        // Búsqueda de evaluaciones
        document.getElementById('evaluationSearch').addEventListener('input', (e) => {
            this.filterEvaluations();
        });

        // Filtro de evaluaciones
        document.getElementById('evaluationFilter').addEventListener('change', (e) => {
            this.filterEvaluations();
        });

        // Búsqueda de gestos
        document.getElementById('signSearch').addEventListener('input', (e) => {
            this.filterSigns();
        });

        // Formulario de evaluación
        document.getElementById('evaluationForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEvaluation();
        });
    }

    async loadSectionData(section) {
        switch (section) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'students':
                await this.loadStudents();
                break;
            case 'evaluations':
                await this.loadEvaluations();
                break;
            case 'signs':
                await this.loadSigns();
                break;
        }
    }

    async loadDashboardData(silent = false) {
        try {
            // Solo mostrar loading si NO es actualización silenciosa
            if (!silent) {
                this.showLoading(true);
            }
            
            // IMPORTANTE: Cargar evaluaciones PRIMERO para calcular promedios correctos
            await this.loadEvaluations();
            await this.loadStudents(); // Ahora puede usar evaluaciones para calcular promedio
            await this.loadSigns(true);
            
            // Actualizar estadísticas del dashboard
            this.updateDashboardStats();
            this.renderRecentActivity();
            
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

    async loadStudents() {
        try {
            const response = await fetch('/api/professor/students', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Error cargando estudiantes');
            }

            const data = await response.json();
            this.students = data.data.students.map(({ student, stats, attempts }) => {
                const normalizedAttempts = (attempts || []).map((attempt, index) => ({
                    id: attempt.id || index,
                    date: attempt.timestamp ? new Date(attempt.timestamp).toISOString() : (attempt.date || new Date().toISOString()),
                    sign: attempt.sign || 'Gesto',
                    score: typeof attempt.percentage === 'number' ? attempt.percentage : 0,
                    status: this.getPerformanceStatus(typeof attempt.percentage === 'number' ? attempt.percentage : 0)
                }));

                // Calcular promedio basado en evaluaciones del profesor (no en intentos)
                const studentEvaluations = this.evaluations.filter(e => e.student_id === student.id);
                const averageFromEvaluations = studentEvaluations.length > 0
                    ? Math.round(studentEvaluations.reduce((sum, e) => sum + (e.score || 0), 0) / studentEvaluations.length)
                    : 0;

                return {
                    id: student.id,
                    firebase_uid: student.firebase_uid,
                    name: student.name,
                    email: student.email,
                    practices: stats.totalAttempts || 0,
                    average: averageFromEvaluations, // Promedio de evaluaciones del profesor
                    lastActivity: stats.lastPractice || student.created_at || new Date().toISOString(),
                    performance: this.getPerformanceStatus(averageFromEvaluations),
                    attempts: normalizedAttempts,
                    evaluationsCount: studentEvaluations.length,
                    raw: student
                };
            });

            this.renderStudentsTable();
            this.updateDashboardStats();
            
        } catch (error) {
            console.error('Error cargando estudiantes:', error);
            this.showMessage('Error cargando estudiantes', 'error');
            this.students = [];
            this.renderStudentsTable();
        }
    }

    async enrichStudentsWithFirebase() {
        // Mantener método por compatibilidad pero ya no es necesario
        return;
    }

    async loadEvaluations() {
        try {
            const response = await fetch('/api/professor/evaluations', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Error cargando evaluaciones');
            }

            const data = await response.json();
            this.evaluations = (data.data.evaluations || []).map(evaluation => ({
                id: evaluation.id,
                studentId: evaluation.studentId,
                studentName: evaluation.studentName,
                studentEmail: evaluation.studentEmail,
                professorId: evaluation.professorId,
                professorName: evaluation.professorName,
                gestureId: evaluation.gestureId,
                gestureName: evaluation.gestureName,
                attemptId: evaluation.attemptId,
                attemptTimestamp: evaluation.attemptTimestamp,
                score: evaluation.score,
                comments: evaluation.comments,
                status: evaluation.status,
                created_at: evaluation.created_at
            }));

            this.renderEvaluationsTable();
            this.renderRecentActivity();
            this.updateDashboardStats();
        } catch (error) {
            console.error('Error cargando evaluaciones:', error);
            this.showMessage('Error cargando evaluaciones', 'error');
            this.evaluations = [];
            this.renderEvaluationsTable();
            this.renderRecentActivity();
        }
    }

    async loadSigns(skipMessage = false) {
        try {
            const response = await fetch('/api/professor/gesture-attempts', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Error cargando gestos detectados');
            }

            const data = await response.json();
            this.gestureAttempts = data.data.attempts || [];
            this.signs = this.gestureAttempts;
            this.renderSignsGrid();
        } catch (error) {
            console.error('Error cargando gestos:', error);
            if (!skipMessage) {
                this.showMessage('Error cargando gestos', 'error');
            }
            this.gestureAttempts = [];
            this.signs = [];
            this.renderSignsGrid();
        }
    }


    updateDashboardStats() {
        const totalStudents = this.students.length;
        const totalEvaluations = this.evaluations.length;
        const averageDetectionScore = totalStudents > 0
            ? Math.round(this.students.reduce((sum, student) => sum + (student.average || 0), 0) / totalStudents)
            : 0;
        const averageEvaluationScore = totalEvaluations > 0
            ? Math.round(this.evaluations.reduce((sum, evaluation) => sum + (evaluation.score || 0), 0) / totalEvaluations)
            : 0;
        const pendingEvaluations = this.evaluations.filter(e => e.status === 'pending').length;
        
        document.getElementById('totalStudents').textContent = totalStudents;
        document.getElementById('totalEvaluations').textContent = totalEvaluations;
        document.getElementById('averageScore').textContent = `${averageEvaluationScore || averageDetectionScore}%`;
        document.getElementById('pendingEvaluations').textContent = pendingEvaluations;
    }

    renderStudentsTable() {
        const tbody = document.getElementById('studentsTableBody');
        
        if (!this.students.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-data">
                        <i class="fas fa-users"></i>
                        <p>No hay estudiantes asignados</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.students.map(student => `
            <tr>
                <td>
                    <div class="student-info">
                        <strong>${student.name}</strong>
                    </div>
                </td>
                <td>${student.email}</td>
                <td>${student.practices}</td>
                <td>
                    <span class="score-badge score-${student.performance}">
                        ${student.average}%
                    </span>
                </td>
                <td>${student.lastActivity ? new Date(student.lastActivity).toLocaleDateString('es-ES') : 'N/A'}</td>
            </tr>
        `).join('');
    }

    renderEvaluationsTable() {
        const tbody = document.getElementById('evaluationsTableBody');
        
        if (!this.evaluations.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-data">
                        <i class="fas fa-clipboard-check"></i>
                        <p>No hay evaluaciones registradas</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.evaluations.map(evaluation => `
            <tr>
                <td>${evaluation.studentName}</td>
                <td>${evaluation.gestureName}</td>
                <td>${evaluation.created_at ? new Date(evaluation.created_at).toLocaleDateString('es-ES') : 'N/A'}</td>
                <td>
                    <span class="status-badge status-${evaluation.status}">
                        ${this.getStatusText(evaluation.status)}
                    </span>
                </td>
                <td>
                    ${typeof evaluation.score === 'number' ? `${evaluation.score}%` : 'Pendiente'}
                </td>
                <td>
                    <button onclick="professorPanel.viewEvaluation(${evaluation.id})" class="btn btn-sm btn-primary">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                    ${evaluation.status === 'pending' ? `
                        <button onclick="professorPanel.completeEvaluation(${evaluation.id})" class="btn btn-sm btn-secondary">
                            <i class="fas fa-check"></i> Completar
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    renderSignsGrid(records = this.gestureAttempts) {
        const container = document.getElementById('signsGrid');
        
        if (!records.length) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-hands"></i>
                    <p>No hay gestos detectados recientemente</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = records.map(record => {
            const masterIndex = this.gestureAttempts.indexOf(record);
            const { student, attempt } = record;
            const detectedScore = typeof attempt.percentage === 'number' ? `${attempt.percentage}%` : 'N/A';
            const detectedDate = attempt.timestamp ? new Date(attempt.timestamp).toLocaleString('es-ES') : 'N/A';
            const signName = attempt.sign || 'Gesto';

            return `
                <div class="sign-card">
                    <h3>${signName}</h3>
                    <p><strong>Estudiante:</strong> ${student?.name || 'Desconocido'}</p>
                    <p><strong>Puntaje detectado:</strong> ${detectedScore}</p>
                    <p><strong>Fecha:</strong> ${detectedDate}</p>
                    <p><strong>Intento:</strong> ${attempt.id || attempt.attemptId || 'N/A'}</p>
                    <div class="sign-actions">
                        <button onclick="professorPanel.startEvaluationFromAttempt(${masterIndex})" class="btn btn-sm btn-primary">
                            <i class="fas fa-clipboard-check"></i> Evaluar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderRecentActivity() {
        const container = document.getElementById('recentActivityList');
        const recentEvaluations = this.evaluations.slice(0, 5);
        
        if (!recentEvaluations.length) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-clipboard-check"></i>
                    <p>No hay actividad reciente</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recentEvaluations.map(evaluation => `
            <div class="activity-item">
                <div class="activity-info">
                    <h4>Evaluación: ${evaluation.gestureName}</h4>
                    <p>Estudiante: ${evaluation.studentName}</p>
                </div>
                <div class="activity-time">
                    ${evaluation.created_at ? new Date(evaluation.created_at).toLocaleDateString('es-ES') : 'N/A'}
                </div>
            </div>
        `).join('');
    }


    filterStudents() {
        const searchTerm = document.getElementById('studentSearch').value.toLowerCase();
        const filterValue = document.getElementById('studentFilter').value;
        
        let filteredStudents = this.students;
        
        // Filtrar por búsqueda
        if (searchTerm) {
            filteredStudents = filteredStudents.filter(student => 
                student.name.toLowerCase().includes(searchTerm) ||
                student.email.toLowerCase().includes(searchTerm)
            );
        }
        
        // Filtrar por rendimiento
        if (filterValue) {
            filteredStudents = filteredStudents.filter(student => {
                switch (filterValue) {
                    case 'excellent':
                        return student.average >= 90;
                    case 'good':
                        return student.average >= 70 && student.average < 90;
                    case 'needs-improvement':
                        return student.average < 70;
                    default:
                        return true;
                }
            });
        }
        
        // Renderizar estudiantes filtrados
        this.renderFilteredStudents(filteredStudents);
    }

    filterEvaluations() {
        const searchTerm = document.getElementById('evaluationSearch').value.toLowerCase();
        const filterValue = document.getElementById('evaluationFilter').value;
        
        let filteredEvaluations = this.evaluations;
        
        // Filtrar por búsqueda
        if (searchTerm) {
            filteredEvaluations = filteredEvaluations.filter(evaluation => 
                evaluation.studentName.toLowerCase().includes(searchTerm) ||
                (evaluation.gestureName || '').toLowerCase().includes(searchTerm)
            );
        }
        
        // Filtrar por estado
        if (filterValue) {
            filteredEvaluations = filteredEvaluations.filter(evaluation => {
                switch (filterValue) {
                    case 'pending':
                        return evaluation.status === 'pending';
                    case 'completed':
                        return evaluation.status === 'completed';
                    case 'overdue':
                        return evaluation.status === 'pending' && evaluation.created_at && new Date(evaluation.created_at) < new Date();
                    default:
                        return true;
                }
            });
        }
        
        // Renderizar evaluaciones filtradas
        this.renderFilteredEvaluations(filteredEvaluations);
    }

    filterSigns() {
        const searchTerm = document.getElementById('signSearch').value.toLowerCase();
        
        let filteredAttempts = this.gestureAttempts;
        
        if (searchTerm) {
            filteredAttempts = filteredAttempts.filter(({ student, attempt }) => {
                const signName = (attempt.sign || '').toLowerCase();
                const studentName = (student?.name || '').toLowerCase();
                const studentEmail = (student?.email || '').toLowerCase();
                return signName.includes(searchTerm) ||
                    studentName.includes(searchTerm) ||
                    studentEmail.includes(searchTerm);
            });
        }
        
        this.renderSignsGrid(filteredAttempts);
    }

    renderFilteredStudents(students) {
        const tbody = document.getElementById('studentsTableBody');
        
        if (!students.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-data">
                        <i class="fas fa-search"></i>
                        <p>No se encontraron estudiantes</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = students.map(student => `
            <tr>
                <td>
                    <div class="student-info">
                        <strong>${student.name}</strong>
                    </div>
                </td>
                <td>${student.email}</td>
                <td>${student.practices}</td>
                <td>
                    <span class="score-badge score-${student.performance}">
                        ${student.average}%
                    </span>
                </td>
                <td>${student.lastActivity ? new Date(student.lastActivity).toLocaleDateString('es-ES') : 'N/A'}</td>
            </tr>
        `).join('');
    }

    renderFilteredEvaluations(evaluations) {
        const tbody = document.getElementById('evaluationsTableBody');
        
        if (!evaluations.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-data">
                        <i class="fas fa-search"></i>
                        <p>No se encontraron evaluaciones</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = evaluations.map(evaluation => `
            <tr>
                <td>${evaluation.studentName}</td>
                <td>${evaluation.gestureName}</td>
                <td>${evaluation.created_at ? new Date(evaluation.created_at).toLocaleDateString('es-ES') : 'N/A'}</td>
                <td>
                    <span class="status-badge status-${evaluation.status}">
                        ${this.getStatusText(evaluation.status)}
                    </span>
                </td>
                <td>
                    ${typeof evaluation.score === 'number' ? `${evaluation.score}%` : 'Pendiente'}
                </td>
                <td>
                    <button onclick="professorPanel.viewEvaluation(${evaluation.id})" class="btn btn-sm btn-primary">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                    ${evaluation.status === 'pending' ? `
                        <button onclick="professorPanel.completeEvaluation(${evaluation.id})" class="btn btn-sm btn-secondary">
                            <i class="fas fa-check"></i> Completar
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    getStatusText(status) {
        const statusMap = {
            'completed': 'Completada',
            'pending': 'Pendiente',
            'overdue': 'Vencida'
        };
        return statusMap[status] || status;
    }
    
    getPerformanceStatus(score) {
        if (score >= 90) return 'excellent';
        if (score >= 70) return 'good';
        if (score < 70) return 'needs-improvement';
        return 'good'; // Valor por defecto
    }

    // Modal de evaluación
    createEvaluation() {
        this.currentEvaluationAttempt = null;
        this.openEvaluationModal({});
    }

    startEvaluationFromAttempt(attemptIndex) {
        const record = this.gestureAttempts[attemptIndex];
        if (!record) {
            this.showMessage('No se encontró la información del intento seleccionado', 'error');
            return;
        }
        this.currentEvaluationAttempt = {
            attemptIndex,
            ...record
        };
        const prefill = {
            studentId: record.student?.id,
            gestureName: record.attempt?.sign,
            gestureId: record.attempt?.gestureId || null,
            attemptId: record.attempt?.id || record.attempt?.attemptId || null,
            attemptTimestamp: record.attempt?.timestamp || null,
            defaultScore: typeof record.attempt?.percentage === 'number' ? record.attempt.percentage : ''
        };
        this.openEvaluationModal(prefill);
    }

    openEvaluationModal(prefill) {
        const today = new Date().toISOString().split('T')[0];
        const evaluationDate = document.getElementById('evaluationDate');
        const evaluationNotes = document.getElementById('evaluationNotes');
        const evaluationScore = document.getElementById('evaluationScore');
        const studentSelect = document.getElementById('evaluationStudent');
        const gestureSelect = document.getElementById('evaluationSign');
        const gestureIdInput = document.getElementById('evaluationGestureId');
        const attemptIdInput = document.getElementById('evaluationAttemptId');
        const timestampInput = document.getElementById('evaluationTimestamp');

        this.populateEvaluationSelectors(prefill);

        if (prefill?.studentId) {
            studentSelect.value = prefill.studentId;
            studentSelect.disabled = true;
        } else {
            studentSelect.disabled = false;
        }

        if (prefill?.gestureName) {
            if (![...gestureSelect.options].some(option => option.value === prefill.gestureName)) {
                const option = document.createElement('option');
                option.value = prefill.gestureName;
                option.textContent = prefill.gestureName;
                gestureSelect.appendChild(option);
            }
            gestureSelect.value = prefill.gestureName;
            gestureSelect.disabled = true;
        } else {
            gestureSelect.disabled = false;
        }

        evaluationDate.value = prefill?.attemptTimestamp
            ? new Date(prefill.attemptTimestamp).toISOString().split('T')[0]
            : today;

        evaluationNotes.value = '';
        evaluationScore.value = prefill?.defaultScore !== '' ? prefill.defaultScore : '';

        gestureIdInput.value = prefill?.gestureId || '';
        attemptIdInput.value = prefill?.attemptId || '';
        timestampInput.value = prefill?.attemptTimestamp || '';

        document.getElementById('evaluationModal').style.display = 'block';
    }

    closeEvaluationModal() {
        document.getElementById('evaluationModal').style.display = 'none';
        document.getElementById('evaluationForm').reset();
        document.getElementById('evaluationStudent').disabled = false;
        document.getElementById('evaluationSign').disabled = false;
        document.getElementById('evaluationGestureId').value = '';
        document.getElementById('evaluationAttemptId').value = '';
        document.getElementById('evaluationTimestamp').value = '';
        this.currentEvaluationAttempt = null;
    }

    populateEvaluationSelectors(prefill = {}) {
        const studentSelect = document.getElementById('evaluationStudent');
        const signSelect = document.getElementById('evaluationSign');
        
        studentSelect.innerHTML = '<option value="">Seleccionar estudiante...</option>';
        signSelect.innerHTML = '<option value="">Primero selecciona un estudiante</option>';
        
        // Deshabilitar selector de gestos hasta que se seleccione un estudiante
        signSelect.disabled = true;
        
        this.students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = student.name;
            studentSelect.appendChild(option);
        });
        
        // Event listener para filtrar gestos cuando cambie el estudiante
        studentSelect.onchange = () => {
            const selectedStudentId = studentSelect.value;
            if (selectedStudentId) {
                // Habilitar selector de gestos
                signSelect.disabled = false;
                this.filterGesturesByStudent(selectedStudentId);
            } else {
                // Deshabilitar selector de gestos
                signSelect.disabled = true;
                signSelect.innerHTML = '<option value="">Primero selecciona un estudiante</option>';
            }
        };
        
        // Si hay un estudiante preseleccionado, habilitar y filtrar sus gestos
        if (prefill?.studentId) {
            signSelect.disabled = false;
            this.filterGesturesByStudent(prefill.studentId);
        } else {
            // Si no hay estudiante seleccionado, mostrar todos los gestos
            const uniqueSigns = Array.from(new Set(this.gestureAttempts
                .map(record => record.attempt?.sign)
                .filter(Boolean)));

            uniqueSigns.forEach(sign => {
                const option = document.createElement('option');
                option.value = sign;
                option.textContent = sign;
                signSelect.appendChild(option);
            });

            if (prefill?.gestureName && !uniqueSigns.includes(prefill.gestureName)) {
                const option = document.createElement('option');
                option.value = prefill.gestureName;
                option.textContent = prefill.gestureName;
                signSelect.appendChild(option);
            }
        }
    }
    
    filterGesturesByStudent(studentId) {
        const signSelect = document.getElementById('evaluationSign');
        signSelect.innerHTML = '<option value="">Seleccionar gesto...</option>';
        
        if (!studentId) {
            // Si no hay estudiante, mostrar todos los gestos
            const uniqueSigns = Array.from(new Set(this.gestureAttempts
                .map(record => record.attempt?.sign)
                .filter(Boolean)));
            
            uniqueSigns.forEach(sign => {
                const option = document.createElement('option');
                option.value = sign;
                option.textContent = sign;
                signSelect.appendChild(option);
            });
            return;
        }
        
        // Filtrar gestos solo del estudiante seleccionado
        const studentGestures = this.gestureAttempts
            .filter(record => record.student?.id == studentId)
            .map(record => record.attempt?.sign)
            .filter(Boolean);
        
        const uniqueStudentSigns = Array.from(new Set(studentGestures));
        
        if (uniqueStudentSigns.length === 0) {
            signSelect.innerHTML = '<option value="">Este estudiante no tiene gestos registrados</option>';
            console.log(`[Filtro] Estudiante ${studentId} no tiene gestos registrados`);
            return;
        }
        
        console.log(`[Filtro] Estudiante ${studentId} tiene ${uniqueStudentSigns.length} gestos únicos: ${uniqueStudentSigns.join(', ')}`);
        
        uniqueStudentSigns.forEach(sign => {
            const option = document.createElement('option');
            option.value = sign;
            option.textContent = sign;
            signSelect.appendChild(option);
        });
    }

    async saveEvaluation() {
        try {
            const studentSelect = document.getElementById('evaluationStudent');
            const gestureSelect = document.getElementById('evaluationSign');
            const evaluationDate = document.getElementById('evaluationDate').value;
            const evaluationNotes = document.getElementById('evaluationNotes').value;
            const evaluationScore = document.getElementById('evaluationScore').value;
            const gestureIdInput = document.getElementById('evaluationGestureId').value;
            const attemptIdInput = document.getElementById('evaluationAttemptId').value;
            const timestampInput = document.getElementById('evaluationTimestamp').value;

            const studentId = studentSelect.value;
            const gestureName = gestureSelect.value;

            if (!studentId || !gestureName || !evaluationDate || evaluationScore === '') {
                this.showMessage('Por favor completa todos los campos requeridos', 'error');
                return;
            }

            const payload = {
                gestureId: gestureIdInput || null,
                gestureName,
                attemptId: attemptIdInput || null,
                attemptTimestamp: timestampInput || null,
                score: Number(evaluationScore),
                comments: evaluationNotes || null,
                status: 'completed'
            };

            const response = await fetch(`/api/professor/students/${studentId}/evaluation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'No se pudo guardar la evaluación');
            }

            this.showMessage('Evaluación creada exitosamente', 'success');
            this.closeEvaluationModal();
            await this.loadEvaluations();
        } catch (error) {
            console.error('Error guardando evaluación:', error);
            this.showMessage(error.message || 'Error guardando evaluación', 'error');
        }
    }

    // Acciones de estudiantes
    viewStudent(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;
        
        this.showMessage(`Viendo detalles de: ${student.name}`, 'success');
    }

    evaluateStudent(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;
        
        this.currentEvaluationAttempt = {
            student,
            attempt: null
        };
        this.openEvaluationModal({ studentId: student.id });
    }

    // Acciones de evaluaciones
    viewEvaluation(evaluationId) {
        const evaluation = this.evaluations.find(e => e.id === evaluationId);
        if (!evaluation) return;
        
        // Llenar el modal con los datos de la evaluación
        document.getElementById('viewEvalStudent').textContent = evaluation.studentName || 'N/A';
        document.getElementById('viewEvalGesture').textContent = evaluation.gestureName || 'N/A';
        document.getElementById('viewEvalDate').textContent = evaluation.created_at 
            ? new Date(evaluation.created_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
            : 'N/A';
        
        // Estado con badge de color
        const statusSpan = document.getElementById('viewEvalStatus');
        statusSpan.textContent = evaluation.status === 'completed' ? 'Completada' : 'Pendiente';
        statusSpan.className = `status-badge ${evaluation.status}`;
        
        // Puntuación con badge de color
        const scoreSpan = document.getElementById('viewEvalScore');
        const score = typeof evaluation.score === 'number' ? evaluation.score : 0;
        scoreSpan.textContent = `${score}%`;
        scoreSpan.className = `score-badge ${this.getScoreClass(score)}`;
        
        // Comentarios
        document.getElementById('viewEvalComments').textContent = evaluation.comments || 'Sin comentarios';
        
        // Mostrar modal
        document.getElementById('viewEvaluationModal').style.display = 'block';
    }
    
    closeViewEvaluationModal() {
        document.getElementById('viewEvaluationModal').style.display = 'none';
    }
    
    getScoreClass(score) {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'average';
        return 'needs-improvement';
    }

    completeEvaluation(evaluationId) {
        const evaluation = this.evaluations.find(e => e.id === evaluationId);
        if (!evaluation) return;
        
        this.showMessage(`La evaluación "${evaluation.gestureName}" ya está registrada`, 'success');
    }

    cleanup() {
        // Espacio reservado para limpiar listeners si se agregan en el futuro
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
    if (window.professorPanel?.cleanup) {
        window.professorPanel.cleanup();
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
    window.professorPanel = new ProfessorPanel();
});
window.addEventListener('beforeunload', () => {
    if (window.professorPanel?.cleanup) {
        window.professorPanel.cleanup();
    }
});