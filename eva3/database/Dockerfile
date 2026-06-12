FROM postgres:15-alpine

LABEL maintainer="Cruz Azul DevOps Team"
LABEL description="PostgreSQL Server para ERP Cruz Azul"

ENV POSTGRES_DB=cruz_azul_db
ENV POSTGRES_USER=cruz_azul_admin
ENV POSTGRES_PASSWORD=CruzAzul2026!

COPY init.sql /docker-entrypoint-initdb.d/01-init.sql

EXPOSE 5432

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD pg_isready -U cruz_azul_admin -d cruz_azul_db || exit 1
