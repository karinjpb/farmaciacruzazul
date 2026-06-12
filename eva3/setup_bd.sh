#!/bin/bash
set -e
echo "========================================="
echo "  PASO 6: Instalando Docker..."
echo "========================================="
sudo apt-get update -qq
sudo apt-get install -y -qq ca-certificates curl gnupg dos2unix
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -qq
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
echo "[OK] Docker: $(docker --version)"

cd ~/cruz_azul-erp
echo "========================================="
echo "  PASO 6.3: Corrigiendo line endings..."
echo "========================================="
find . -type f \( -name "*.yml" -o -name "*.yaml" -o -name "*.js" -o -name "*.json" -o -name "*.html" -o -name "*.css" -o -name "*.sql" -o -name "Dockerfile" -o -name "*.md" \) -exec dos2unix -q {} \;

echo "========================================="
echo "  PASO 7: Build + Deploy BD..."
echo "========================================="
sudo docker compose down --remove-orphans 2>/dev/null || true
sudo docker compose build --no-cache cruz-azul-bd
sudo docker compose up -d cruz-azul-bd
echo "  Esperando 15s..."
sleep 15

echo "========================================="
echo "  VERIFICACIÓN"
echo "========================================="
sudo docker compose ps
echo ""
sudo docker compose logs cruz-azul-bd --tail=10
echo ""
echo "=== pg_isready ==="
sudo docker exec cruz-azul-bd pg_isready -U cruz_azul_admin -d cruz_azul_db
echo ""
echo "=== Productos ==="
sudo docker exec cruz-azul-bd psql -U cruz_azul_admin -d cruz_azul_db -c "SELECT id, nombre, categoria FROM productos ORDER BY id;"
echo ""
echo "========================================="
echo "  BD LISTA en 32.198.30.25 (10.0.1.99)"
echo "========================================="
