#!/bin/bash
# Script de ayuda para desplegar en Google Cloud Run

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Despliegue de Gestus en Google Cloud Run ===${NC}\n"

# Verificar que gcloud esté instalado
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI no está instalado.${NC}"
    echo "Instala Google Cloud SDK desde: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Obtener el proyecto actual
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}No hay un proyecto configurado.${NC}"
    read -p "Ingresa el ID del proyecto de Google Cloud: " PROJECT_ID
    gcloud config set project $PROJECT_ID
fi

echo -e "${GREEN}Proyecto: ${PROJECT_ID}${NC}\n"

# Verificar que las APIs estén habilitadas
echo "Verificando APIs necesarias..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com sqladmin.googleapis.com containerregistry.googleapis.com secretmanager.googleapis.com

# Preguntar qué hacer
echo -e "\n${YELLOW}¿Qué deseas hacer?${NC}"
echo "1) Desplegar usando Cloud Build (recomendado)"
echo "2) Construir y desplegar manualmente"
echo "3) Solo construir la imagen Docker localmente"
read -p "Opción [1-3]: " option

case $option in
    1)
        echo -e "\n${GREEN}Desplegando con Cloud Build...${NC}"
        gcloud builds submit --config=cloudbuild.yaml .
        ;;
    2)
        echo -e "\n${GREEN}Construyendo imagen Docker...${NC}"
        docker build -t gcr.io/${PROJECT_ID}/gestus-app:latest .
        
        echo -e "\n${GREEN}Autenticando en Google Container Registry...${NC}"
        gcloud auth configure-docker
        
        echo -e "\n${GREEN}Subiendo imagen...${NC}"
        docker push gcr.io/${PROJECT_ID}/gestus-app:latest
        
        echo -e "\n${YELLOW}Ahora despliega manualmente con:${NC}"
        echo "gcloud run deploy gestus-app \\"
        echo "  --image gcr.io/${PROJECT_ID}/gestus-app:latest \\"
        echo "  --platform managed \\"
        echo "  --region us-central1 \\"
        echo "  --allow-unauthenticated"
        ;;
    3)
        echo -e "\n${GREEN}Construyendo imagen Docker localmente...${NC}"
        docker build -t gestus-app:local .
        echo -e "${GREEN}Imagen construida: gestus-app:local${NC}"
        ;;
    *)
        echo -e "${RED}Opción inválida${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}¡Completado!${NC}"

