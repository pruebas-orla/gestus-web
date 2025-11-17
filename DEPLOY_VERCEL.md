# Guía de Despliegue en Vercel

Esta guía te ayudará a desplegar la aplicación Gestus en Vercel.

## Prerrequisitos

1. **Cuenta de Vercel** (gratuita): https://vercel.com
2. **GitHub** (el proyecto debe estar en GitHub)
3. **Node.js** instalado localmente (para pruebas)

## Paso 1: Preparar el Proyecto

El proyecto ya está configurado con:
- ✅ `vercel.json` - Configuración de Vercel
- ✅ `config.js` - Detección automática de entorno
- ✅ Rutas API configuradas correctamente

## Paso 2: Desplegar en Vercel

### Opción A: Desde la Web de Vercel (Recomendado)

1. Ve a https://vercel.com y inicia sesión con GitHub
2. Haz clic en "Add New Project"
3. Importa el repositorio `pruebas-orla/gestus-web`
4. Vercel detectará automáticamente la configuración:
   - Framework Preset: Other
   - Build Command: (dejar vacío o `npm install`)
   - Output Directory: (dejar vacío)
   - Install Command: `npm install`

5. **Configurar Variables de Entorno:**
   - Ve a Settings → Environment Variables
   - Agrega las siguientes variables:

```
PORT=3000
JWT_SECRET=tu-secret-key-muy-seguro
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ALGORITHM=HS256
DB_HOST=tu-host-de-base-de-datos
DB_PORT=3306
DB_NAME=webprojectdb
DB_USER=tu-usuario
DB_PASSWORD=tu-password
FIREBASE_DATABASE_URL=https://gestusproject-default-rtdb.firebaseio.com
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

6. Haz clic en "Deploy"

### Opción B: Desde la CLI de Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Iniciar sesión
vercel login

# Desplegar
vercel

# Para producción
vercel --prod
```

## Paso 3: Configurar Base de Datos

Vercel no soporta bases de datos MySQL directamente. Tienes varias opciones:

### Opción 1: Base de Datos Externa (Recomendado)

Usa un servicio de base de datos MySQL en la nube:
- **PlanetScale** (gratis): https://planetscale.com
- **Railway** (gratis): https://railway.app
- **Aiven** (trial gratuito): https://aiven.io
- **Google Cloud SQL** (pago)

Configura las variables de entorno con las credenciales de tu base de datos.

### Opción 2: Serverless MySQL

Considera migrar a una solución serverless como:
- **Supabase** (PostgreSQL, gratis)
- **Firebase Firestore** (NoSQL, gratis)
- **MongoDB Atlas** (gratis)

## Paso 4: Configurar Firebase

1. Obtén tu `serviceAccountKey.json` de Firebase Console
2. Convierte el JSON a string y agrégalo como variable de entorno:
   ```bash
   # En Vercel Dashboard → Settings → Environment Variables
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
   ```

## Paso 5: Verificar el Despliegue

Después del despliegue, Vercel te dará una URL como:
```
https://gestus-web.vercel.app
```

Visita la URL y verifica que:
- ✅ La página de inicio carga correctamente
- ✅ El login funciona
- ✅ Las rutas API responden correctamente

## Configuración de Rutas

El archivo `vercel.json` está configurado para:
- Servir archivos estáticos desde `/public`
- Redirigir todas las rutas `/api/*` al servidor Node.js
- Servir el frontend desde el servidor Express

## Variables de Entorno Importantes

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del servidor (Vercel lo configura automáticamente) | `3000` |
| `JWT_SECRET` | Clave secreta para JWT | `tu-secret-key` |
| `DB_HOST` | Host de la base de datos | `us-east.connect.psdb.cloud` |
| `DB_NAME` | Nombre de la base de datos | `webprojectdb` |
| `DB_USER` | Usuario de la base de datos | `root` |
| `DB_PASSWORD` | Contraseña de la base de datos | `password123` |
| `FIREBASE_DATABASE_URL` | URL de Firebase Realtime Database | `https://...firebaseio.com` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Credenciales de Firebase (JSON string) | `{"type":"service_account"...}` |

## Solución de Problemas

### Error: "Cannot find module"

**Solución:** Asegúrate de que `package.json` tenga todas las dependencias listadas.

### Error: "Database connection failed"

**Solución:** 
- Verifica que las variables de entorno de la base de datos estén correctas
- Asegúrate de que tu base de datos permita conexiones externas
- Verifica que el firewall de tu base de datos permita conexiones desde Vercel

### Error: "ERR_CONNECTION_REFUSED" en el frontend

**Solución:** 
- Verifica que `config.js` esté cargado antes de otros scripts
- Revisa la consola del navegador para ver qué URL está usando
- Asegúrate de que las rutas API estén configuradas correctamente en `vercel.json`

### Error: "CORS policy"

**Solución:** El servidor ya tiene CORS configurado. Si persiste, verifica que el dominio de Vercel esté permitido.

## Actualizar el Despliegue

Cada vez que hagas push a GitHub, Vercel desplegará automáticamente:

```bash
git add .
git commit -m "Actualización"
git push
```

O puedes desplegar manualmente desde Vercel Dashboard o CLI:

```bash
vercel --prod
```

## Dominio Personalizado

1. Ve a Vercel Dashboard → Settings → Domains
2. Agrega tu dominio personalizado
3. Configura los registros DNS según las instrucciones de Vercel

## Monitoreo y Logs

- **Logs en tiempo real:** Vercel Dashboard → Deployments → [Tu deployment] → Logs
- **Métricas:** Vercel Dashboard → Analytics
- **Errores:** Vercel Dashboard → Logs

## Límites del Plan Gratuito

- **100 GB bandwidth/mes**
- **100 horas de función serverless/mes**
- **Deployments ilimitados**
- **Dominios personalizados ilimitados**

## Recursos Adicionales

- [Documentación de Vercel](https://vercel.com/docs)
- [Guía de Node.js en Vercel](https://vercel.com/docs/concepts/functions/serverless-functions/runtimes/node-js)
- [Variables de Entorno en Vercel](https://vercel.com/docs/concepts/projects/environment-variables)

