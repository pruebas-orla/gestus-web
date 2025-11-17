# Guía de Despliegue en Google Cloud

Esta guía te ayudará a desplegar la aplicación Gestus en Google Cloud Platform usando Docker y Cloud Run.

## Prerrequisitos

1. **Cuenta de Google Cloud Platform** con facturación habilitada
2. **Google Cloud SDK (gcloud)** instalado y configurado
3. **Docker** instalado (para pruebas locales)
4. **Proyecto de Firebase** configurado

## Paso 1: Configurar el Proyecto de Google Cloud

### 1.1 Crear un nuevo proyecto (o usar uno existente)

```bash
# Listar proyectos existentes
gcloud projects list

# Crear nuevo proyecto (opcional)
gcloud projects create gestus-project --name="Gestus App"

# Configurar el proyecto actual
gcloud config set project gestus-project
```

### 1.2 Habilitar APIs necesarias

```bash
# Habilitar Cloud Run API
gcloud services enable run.googleapis.com

# Habilitar Cloud Build API
gcloud services enable cloudbuild.googleapis.com

# Habilitar Cloud SQL Admin API
gcloud services enable sqladmin.googleapis.com

# Habilitar Container Registry API
gcloud services enable containerregistry.googleapis.com

# Habilitar Secret Manager API
gcloud services enable secretmanager.googleapis.com
```

## Paso 2: Configurar Cloud SQL (Base de Datos MySQL)

### 2.1 Crear instancia de Cloud SQL

```bash
# Crear instancia de MySQL
gcloud sql instances create gestus-db \
  --database-version=MYSQL_8_0 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=TU_PASSWORD_SEGURO \
  --storage-type=SSD \
  --storage-size=10GB
```

**Nota:** Cambia `TU_PASSWORD_SEGURO` por una contraseña segura.

### 2.2 Crear base de datos y usuario

```bash
# Conectarse a la instancia
gcloud sql connect gestus-db --user=root

# Dentro de MySQL, ejecutar:
CREATE DATABASE webprojectdb;
CREATE USER 'gestus'@'%' IDENTIFIED BY 'TU_PASSWORD_SEGURO';
GRANT ALL PRIVILEGES ON webprojectdb.* TO 'gestus'@'%';
FLUSH PRIVILEGES;
EXIT;
```

### 2.3 Obtener la conexión de la instancia

```bash
# Obtener el nombre completo de la instancia
gcloud sql instances describe gestus-db --format="value(connectionName)"
```

Guarda este valor, lo necesitarás para el `cloudbuild.yaml`.

## Paso 3: Configurar Secret Manager

### 3.1 Crear secretos

```bash
# Secreto para la contraseña de la base de datos
echo -n "TU_PASSWORD_SEGURO" | gcloud secrets create db-password --data-file=-

# Secreto para JWT_SECRET
echo -n "TU_JWT_SECRET_MUY_SEGURO" | gcloud secrets create jwt-secret --data-file=-

# Secreto para Firebase Service Account JSON
# Primero, obtén el contenido de tu serviceAccountKey.json
cat ruta/a/tu/serviceAccountKey.json | gcloud secrets create firebase-service-account --data-file=-
```

### 3.2 Otorgar permisos a Cloud Run

```bash
# Obtener el service account de Cloud Run
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Otorgar permisos para acceder a los secretos
gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding firebase-service-account \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

## Paso 4: Configurar Cloud Build

### 4.1 Actualizar cloudbuild.yaml

Edita el archivo `cloudbuild.yaml` y actualiza las siguientes variables en la sección `substitutions`:

```yaml
substitutions:
  _CLOUDSQL_INSTANCE: 'TU_PROJECT_ID:us-central1:gestus-db'
  _DB_NAME: 'webprojectdb'
  _DB_USER: 'gestus'
  _FIREBASE_DATABASE_URL: 'https://gestusproject-default-rtdb.firebaseio.com'
```

### 4.2 Otorgar permisos a Cloud Build

```bash
# Otorgar permisos para desplegar en Cloud Run
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

# Otorgar permisos para acceder a Cloud SQL
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

## Paso 5: Desplegar la Aplicación

### Opción A: Despliegue automático con Cloud Build

```bash
# Enviar el código a Cloud Build
gcloud builds submit --config=cloudbuild.yaml .
```

### Opción B: Despliegue manual

#### 5.1 Construir la imagen Docker localmente

```bash
# Construir la imagen
docker build -t gcr.io/TU_PROJECT_ID/gestus-app:latest .

# Autenticarse en Google Container Registry
gcloud auth configure-docker

# Subir la imagen
docker push gcr.io/TU_PROJECT_ID/gestus-app:latest
```

#### 5.2 Desplegar en Cloud Run

```bash
# Desplegar el servicio
gcloud run deploy gestus-app \
  --image gcr.io/TU_PROJECT_ID/gestus-app:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --add-cloudsql-instances TU_PROJECT_ID:us-central1:gestus-db \
  --set-secrets DB_PASSWORD=db-password:latest,JWT_SECRET=jwt-secret:latest,FIREBASE_SERVICE_ACCOUNT_JSON=firebase-service-account:latest \
  --set-env-vars PORT=8080,DB_HOST=/cloudsql/TU_PROJECT_ID:us-central1:gestus-db,DB_PORT=3306,DB_NAME=webprojectdb,DB_USER=gestus,FIREBASE_DATABASE_URL=https://gestusproject-default-rtdb.firebaseio.com
```

**Nota:** Reemplaza `TU_PROJECT_ID` con tu ID de proyecto de Google Cloud.

## Paso 6: Configurar Variables de Entorno Adicionales

Si necesitas configurar más variables de entorno después del despliegue:

```bash
gcloud run services update gestus-app \
  --region us-central1 \
  --update-env-vars VARIABLE=valor
```

## Paso 7: Verificar el Despliegue

### 7.1 Obtener la URL del servicio

```bash
gcloud run services describe gestus-app --region us-central1 --format="value(status.url)"
```

### 7.2 Probar la aplicación

Visita la URL obtenida en tu navegador. Deberías ver la aplicación funcionando.

## Paso 8: Configurar Dominio Personalizado (Opcional)

```bash
# Mapear un dominio personalizado
gcloud run domain-mappings create \
  --service gestus-app \
  --domain tu-dominio.com \
  --region us-central1
```

## Monitoreo y Logs

### Ver logs en tiempo real

```bash
gcloud run services logs read gestus-app --region us-central1 --limit 50
```

### Ver métricas en la consola

Visita: https://console.cloud.google.com/run

## Actualizar la Aplicación

Para actualizar la aplicación después de hacer cambios:

```bash
# Opción 1: Usar Cloud Build (recomendado)
gcloud builds submit --config=cloudbuild.yaml .

# Opción 2: Reconstruir y redesplegar manualmente
docker build -t gcr.io/TU_PROJECT_ID/gestus-app:latest .
docker push gcr.io/TU_PROJECT_ID/gestus-app:latest
gcloud run deploy gestus-app --image gcr.io/TU_PROJECT_ID/gestus-app:latest --region us-central1
```

## Solución de Problemas

### Error: "Cloud SQL connection failed"

- Verifica que la instancia de Cloud SQL esté en la misma región que Cloud Run
- Asegúrate de que el servicio tenga permisos para conectarse a Cloud SQL
- Verifica que el nombre de la instancia en `--add-cloudsql-instances` sea correcto

### Error: "Secret not found"

- Verifica que los secretos existan en Secret Manager
- Asegúrate de que el service account de Cloud Run tenga permisos para acceder a los secretos

### Error: "Database connection timeout"

- Verifica que la contraseña de la base de datos sea correcta
- Asegúrate de que el usuario de la base de datos tenga los permisos necesarios
- Verifica que la base de datos exista

## Costos Estimados

- **Cloud Run:** Pago por uso (muy económico para tráfico bajo)
- **Cloud SQL:** ~$7-10/mes para db-f1-micro
- **Cloud Build:** Primeros 120 minutos/día gratis
- **Container Registry:** Primeros 0.5 GB gratis

## Recursos Adicionales

- [Documentación de Cloud Run](https://cloud.google.com/run/docs)
- [Documentación de Cloud SQL](https://cloud.google.com/sql/docs)
- [Documentación de Secret Manager](https://cloud.google.com/secret-manager/docs)

