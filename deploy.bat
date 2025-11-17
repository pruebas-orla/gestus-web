@echo off
REM Script de ayuda para desplegar en Google Cloud Run (Windows)

echo === Despliegue de Gestus en Google Cloud Run ===
echo.

REM Verificar que gcloud esté instalado
where gcloud >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: gcloud CLI no está instalado.
    echo Instala Google Cloud SDK desde: https://cloud.google.com/sdk/docs/install
    pause
    exit /b 1
)

REM Obtener el proyecto actual
for /f "tokens=*" %%i in ('gcloud config get-value project 2^>nul') do set PROJECT_ID=%%i

if "%PROJECT_ID%"=="" (
    echo No hay un proyecto configurado.
    set /p PROJECT_ID="Ingresa el ID del proyecto de Google Cloud: "
    gcloud config set project %PROJECT_ID%
)

echo Proyecto: %PROJECT_ID%
echo.

REM Verificar que las APIs estén habilitadas
echo Verificando APIs necesarias...
gcloud services enable run.googleapis.com cloudbuild.googleapis.com sqladmin.googleapis.com containerregistry.googleapis.com secretmanager.googleapis.com

REM Preguntar qué hacer
echo.
echo ¿Qué deseas hacer?
echo 1) Desplegar usando Cloud Build (recomendado)
echo 2) Construir y desplegar manualmente
echo 3) Solo construir la imagen Docker localmente
set /p option="Opción [1-3]: "

if "%option%"=="1" (
    echo.
    echo Desplegando con Cloud Build...
    gcloud builds submit --config=cloudbuild.yaml .
) else if "%option%"=="2" (
    echo.
    echo Construyendo imagen Docker...
    docker build -t gcr.io/%PROJECT_ID%/gestus-app:latest .
    
    echo.
    echo Autenticando en Google Container Registry...
    gcloud auth configure-docker
    
    echo.
    echo Subiendo imagen...
    docker push gcr.io/%PROJECT_ID%/gestus-app:latest
    
    echo.
    echo Ahora despliega manualmente con:
    echo gcloud run deploy gestus-app --image gcr.io/%PROJECT_ID%/gestus-app:latest --platform managed --region us-central1 --allow-unauthenticated
) else if "%option%"=="3" (
    echo.
    echo Construyendo imagen Docker localmente...
    docker build -t gestus-app:local .
    echo Imagen construida: gestus-app:local
) else (
    echo Opción inválida
    pause
    exit /b 1
)

echo.
echo ¡Completado!
pause

