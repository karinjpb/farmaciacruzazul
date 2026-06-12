#!/bin/bash
# =============================================
# Script de Backup diario a AWS S3
# Ejecutar via cron: 0 3 * * * /srv/cruz_azul-erp/backup_s3.sh
# =============================================

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUCKET="s3://cruz-azul-backups-2026"
BACKUP_DIR="/tmp/backups"
DB_HOST="cruz-azul-db.cdarw4savmfx.us-east-1.rds.amazonaws.com"

mkdir -p $BACKUP_DIR

# Exportar BD desde RDS
PGPASSWORD='CruzAzul2026!' pg_dump \
    -h $DB_HOST \
    -U cruz_azul_admin \
    -d cruz_azul_db \
    -F c \
    -f $BACKUP_DIR/cruz_azul_db_$TIMESTAMP.dump

# Subir a S3
aws s3 cp $BACKUP_DIR/cruz_azul_db_$TIMESTAMP.dump \
    $BUCKET/backups/cruz_azul_db_$TIMESTAMP.dump \
    --acl bucket-owner-full-control

# Limpiar temporales
rm -f $BACKUP_DIR/cruz_azul_db_$TIMESTAMP.dump

echo "[OK] Backup completado: cruz_azul_db_$TIMESTAMP.dump → $BUCKET"
