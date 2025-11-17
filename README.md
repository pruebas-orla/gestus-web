# Sistema Web con Express.js y Frontend Vanilla
## Características
- **Backend**: Express.js + Node.js
- **Base de datos**: MySQL (XAMPP)
- **Autenticación**: JWT (JSON Web Tokens)
- **Seguridad**: Hash de contraseñas con bcryptjs
- **Frontend**: HTML, CSS y JavaScript vanilla
- **Validaciones**: Frontend y backend
## Estructura del Proyecto
```
WEB/
├── config/
│   └── database.js          # Configuración de MySQL
├── models/
│   └── User.js              # Modelo de usuario
├── routes/
│   ├── auth.js              # Rutas de autenticación
│   └── users.js             # Rutas de usuarios
├── public/
│   ├── index.html           # Página de login/registro
│   ├── dashboard.html       # Dashboard del usuario
│   ├── styles.css           # Estilos principales
│   ├── dashboard.css        # Estilos del dashboard
│   ├── script.js            # JavaScript principal
│   └── dashboard.js         # JavaScript del dashboard
├── server.js                # Servidor principal
├── package.json             # Dependencias del proyecto
├── config.env               # Configuración de entorno
└── README.md                # Este archivo
```
## Instalación

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configurar MySQL (XAMPP)**:
   - Instala XAMPP y ejecuta Apache y MySQL
   - Crea una base de datos llamada `webprojectdb`
   - Ejecuta el script SQL proporcionado para crear las tablas

3. **Configurar variables de entorno**:
   Edita `config.env` y configura:
   ```
   PORT=3000
   JWT_SECRET=tu_clave_secreta_muy_segura_aqui
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=webprojectdb
   DB_USER=root
   DB_PASSWORD=
   ```

4. **Ejecutar el servidor**:
   ```bash
   # Desarrollo
   npm run dev
   
   # Producción
   npm start
   ```

5. **Acceder a la aplicación**:
   Abre tu navegador en `http://localhost:3000`

## Funcionalidades Implementadas

### Backend

- **Modelo de Usuario**:
  - Campos: id, name, email, password, firebase_uid, role, parent_id, created_at, updated_at
  - Hash seguro de contraseñas con bcryptjs
  - Validaciones de datos
  - Soporte para usuarios de Firebase

- **Autenticación**:
  - Registro de usuarios
  - Login con JWT
  - Verificación de tokens
  - Middleware de autenticación
  - Cambio de contraseña
  - **Sincronización con Firebase**: Los usuarios de Firebase pueden usar sus credenciales para login

- **Sistema de Roles**:
  - Administrador (admin)
  - Profesor (profesor)
  - Estudiante (estudiante)
  - Padre (padre)

- **Rutas API**:
  - `POST /api/auth/register` - Registro
  - `POST /api/auth/login` - Login
  - `GET /api/auth/verify` - Verificar token
  - `POST /api/auth/change-password` - Cambiar contraseña
  - `GET /api/users/profile` - Obtener perfil
  - `PUT /api/users/profile` - Actualizar perfil
  - `DELETE /api/users/profile` - Eliminar cuenta
  - `GET /api/roles/all` - Obtener todos los usuarios (admin, sincroniza con Firebase)

### Sincronización con Firebase

El sistema sincroniza automáticamente usuarios desde Firebase Realtime Database a MySQL:

1. **Contraseñas desde Firebase**: Si el usuario en Firebase tiene un campo `password`, se usa para el login
2. **Contraseña predeterminada**: Si no hay contraseña en Firebase, se genera automáticamente:
   - Formato: `[primeros 6 caracteres del email]123`
   - Ejemplo: `usuario@ejemplo.com` → contraseña: `usuari123`

**Para más información**: Ver `docs/SINCRONIZACION_PASSWORDS_FIREBASE.md`

### Frontend

- **Formulario de Login**:
  - Validaciones en tiempo real
  - Toggle de visibilidad de contraseña
  - Manejo de errores
  - Estados de carga

- **Formulario de Registro**:
  - Validación de contraseñas
  - Confirmación de contraseña
  - Validación de email

- **Dashboard**:
  - Información del usuario
  - Gestión de perfil
  - Logout seguro

## Seguridad

- **Contraseñas**: Hash con bcryptjs (10 rounds)
- **Tokens**: JWT con expiración de 24 horas
- **Validaciones**: Frontend y backend
- **CORS**: Configurado para desarrollo
- **Sanitización**: Datos de entrada validados

## Responsive Design

- Diseño adaptable para móviles y desktop
- Interfaz moderna con gradientes
- Animaciones suaves
- UX optimizada

## Uso

1. **Registro**: Crea una nueva cuenta con nombre, email y contraseña
2. **Login**: Inicia sesión con tus credenciales
3. **Dashboard**: Accede a tu panel personal
4. **Perfil**: Gestiona tu información personal

## Desarrollo

### Estructura de Base de Datos

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Variables de Entorno

- `PORT`: Puerto del servidor (default: 3000)
- `JWT_SECRET`: Clave secreta para JWT
- `DB_HOST`: Host de MySQL (default: localhost)
- `DB_NAME`: Nombre de la base de datos (default: webprojectdb)
- `DB_USER`: Usuario de MySQL (default: root)
- `DB_PASSWORD`: Contraseña de MySQL (default: vacío)
- `DB_PORT`: Puerto de MySQL (default: 3306)


## Docker

### Desarrollo Local con Docker Compose

```bash
# Construir y levantar los contenedores
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener los contenedores
docker-compose down

# Reconstruir después de cambios
docker-compose up -d --build
```

La aplicación estará disponible en `http://localhost:5000`

### Construir Imagen Docker

```bash
# Construir la imagen
docker build -t gestus-app .

# Ejecutar el contenedor
docker run -p 5000:8080 \
  -e DB_HOST=mysql \
  -e DB_USER=gestus \
  -e DB_PASSWORD=gestuspassword \
  -e DB_NAME=webprojectdb \
  gestus-app
```

## Despliegue en Google Cloud

Este proyecto está configurado para desplegarse en **Google Cloud Run** usando Docker.

### Prerrequisitos

- Cuenta de Google Cloud Platform
- Google Cloud SDK instalado (`gcloud`)
- Docker instalado

### Despliegue Rápido

1. **Configura el proyecto de Google Cloud:**
   ```bash
   gcloud config set project TU_PROJECT_ID
   ```

2. **Despliega usando Cloud Build:**
   ```bash
   gcloud builds submit --config=cloudbuild.yaml .
   ```

3. **O usa el script de ayuda:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

### Documentación Completa

Para instrucciones detalladas sobre cómo configurar Cloud SQL, Secret Manager, y todas las opciones de despliegue, consulta:

📖 **[DEPLOY_GOOGLE_CLOUD.md](./DEPLOY_GOOGLE_CLOUD.md)**

### Archivos de Configuración

- `Dockerfile` - Imagen Docker optimizada para producción
- `docker-compose.yml` - Configuración para desarrollo local
- `cloudbuild.yaml` - Configuración de Google Cloud Build
- `.gcloudignore` - Archivos ignorados en el despliegue
- `config.env.example` - Plantilla de variables de entorno

## Solución de Problemas

1. **Error de conexión**: Verifica que el servidor esté corriendo
2. **Token inválido**: Haz logout y vuelve a iniciar sesión
3. **Base de datos**: Verifica que MySQL esté corriendo en XAMPP y las credenciales sean correctas
4. **Error de conexión MySQL**: Verifica que el usuario tenga permisos en la base de datos
5. **Puerto ocupado**: Cambia el puerto en las variables de entorno si 3306 está ocupado
6. **Error en Docker**: Verifica que Docker esté corriendo y que los puertos no estén ocupados
7. **Error en Cloud Run**: Revisa los logs con `gcloud run services logs read gestus-app --region us-central1`

