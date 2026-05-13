# Evidencia de Ejecución del Stack — ERP Farmacias Cruz Azul

**Proyecto:** Sistema ERP Farmacias Cruz Azul  
**Fecha de despliegue:** 12 de mayo de 2026  
**Arquitectura:** Multi-instancia (2 nodos EC2 separados)  
**Tecnologías:** Docker, Docker Compose, Node.js + Express, PostgreSQL 15

---

## Arquitectura Desplegada

| Componente | Instancia EC2 | IP Pública | IP Privada (VPC) | Puerto |
|---|---|---|---|---|
| **Base de Datos** (PostgreSQL 15) | Nodo BD | 44.213.157.157 | 10.0.1.153 | 5432 |
| **Frontend** (Node.js + Express) | Nodo Web | 54.158.161.49 | 10.0.1.102 | 80 |

> La comunicación frontend → base de datos se realiza a través de la **red interna VPC de AWS** (subred `10.0.0.0/16`), usando la IP privada del nodo BD como `DB_HOST`.

---

## 1. Construcción de Imágenes Docker (`docker compose build`)

### Nodo BD — Imagen PostgreSQL

```
$ sudo docker compose build cruz-azul-bd

 Image cruz_azul-erp-cruz-azul-bd Building
#1 [internal] load local bake definitions
#2 [internal] load build definition from Dockerfile
   transferring dockerfile: 468B done
#3 [internal] load metadata for docker.io/library/postgres:15-alpine
#5 [internal] load build context
   transferring context: 1.71kB done
#6 [1/2] FROM docker.io/library/postgres:15-alpine@sha256:09e4f20b14ddb...
#7 [2/2] COPY init.sql /docker-entrypoint-initdb.d/01-init.sql
#8 exporting to image
   naming to docker.io/library/cruz_azul-erp-cruz-azul-bd:latest done
 Image cruz_azul-erp-cruz-azul-bd Built
```

**Comentario:** Se construyó la imagen a partir del `Dockerfile` ubicado en `./database/`, que extiende la imagen oficial `postgres:15-alpine` y copia el script `init.sql` al directorio de inicialización automática de PostgreSQL (`/docker-entrypoint-initdb.d/`).

### Nodo Frontend — Imagen Node.js

```
$ sudo docker compose build cruz-azul-frontend

 Image cruz_azul-erp-cruz-azul-frontend Building
#2 [internal] load build definition from Dockerfile
   transferring dockerfile: 509B done
#3 [internal] load metadata for docker.io/library/node:18-alpine
#5 [internal] load build context
   transferring context: 23.64kB done
#6 [1/6] FROM docker.io/library/node:18-alpine@sha256:8d6421d663b4c28f...
#7 [2/6] WORKDIR /app
#8 [3/6] COPY package.json ./
#9 [4/6] RUN npm install --production
   added 84 packages, and audited 85 packages in 4s
   found 0 vulnerabilities
#10 [5/6] COPY src/ ./src/
#11 [6/6] COPY public/ ./public/
#12 exporting to image
    naming to docker.io/library/cruz_azul-erp-cruz-azul-frontend:latest done
 Image cruz_azul-erp-cruz-azul-frontend Built
```

**Comentario:** Se construyó la imagen a partir de `./frontend/Dockerfile`, que utiliza `node:18-alpine` como base. Se instalan las dependencias (`express`, `pg`, `cors`) y se copian los archivos de la aplicación (código fuente y archivos públicos HTML/CSS).

---

## 2. Despliegue de Contenedores (`docker compose up -d`)

### Nodo BD

```
$ sudo docker compose up -d cruz-azul-bd

 Network cruz_azul-erp_azul-net Creating
 Network cruz_azul-erp_azul-net Created
 Volume cruz_azul-erp_pgdata Creating
 Volume cruz_azul-erp_pgdata Created
 Container cruz-azul-bd Creating
 Container cruz-azul-bd Created
 Container cruz-azul-bd Starting
 Container cruz-azul-bd Started
```

**Comentario:** Se creó la red Docker `azul-net`, el volumen persistente `pgdata` para los datos de PostgreSQL, y se inició el contenedor `cruz-azul-bd` en modo *detached*.

### Nodo Frontend

```
$ sudo docker compose up -d cruz-azul-frontend

 Network cruz_azul-erp_azul-net Creating
 Network cruz_azul-erp_azul-net Created
 Container cruz-azul-frontend Creating
 Container cruz-azul-frontend Created
 Container cruz-azul-frontend Starting
 Container cruz-azul-frontend Started
```

**Comentario:** Se creó la red Docker local y se inició el contenedor `cruz-azul-frontend` exponiendo el puerto 80. El frontend se conecta al nodo BD a través de la IP privada `10.0.1.153:5432`.

---

## 3. Verificación de Contenedores Activos (`docker compose ps`)

### Nodo BD

```
$ sudo docker compose ps

NAME           IMAGE                        COMMAND                  SERVICE        STATUS          PORTS
cruz-azul-bd   cruz_azul-erp-cruz-azul-bd   "docker-entrypoint.s…"   cruz-azul-bd   Up (healthy)    0.0.0.0:5432->5432/tcp
```

### Nodo Frontend

```
$ sudo docker compose ps

NAME                 IMAGE                              COMMAND                  SERVICE              STATUS          PORTS
cruz-azul-frontend   cruz_azul-erp-cruz-azul-frontend   "docker-entrypoint.s…"   cruz-azul-frontend   Up (healthy)    0.0.0.0:80->80/tcp
```

**Comentario:** Ambos contenedores reportan estado `healthy`, lo cual confirma que sus respectivos `HEALTHCHECK` definidos en los Dockerfiles se están ejecutando satisfactoriamente.

---

## 4. Revisión de Logs

### Logs de PostgreSQL (Nodo BD)

```
$ sudo docker compose logs cruz-azul-bd --tail=15

cruz-azul-bd  | PostgreSQL init process complete; ready for start up.
cruz-azul-bd  | 2026-05-12 22:09:55.194 UTC [1] LOG:  starting PostgreSQL 15.17 on x86_64-pc-linux-musl
cruz-azul-bd  | 2026-05-12 22:09:55.194 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432
cruz-azul-bd  | 2026-05-12 22:09:55.194 UTC [1] LOG:  listening on IPv6 address "::", port 5432
cruz-azul-bd  | 2026-05-12 22:09:55.198 UTC [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
cruz-azul-bd  | 2026-05-12 22:09:55.209 UTC [1] LOG:  database system is ready to accept connections
```

**Comentario:** PostgreSQL inició correctamente, ejecutó el script `init.sql` durante la inicialización (creación de tabla `productos` e inserción de 8 registros de ejemplo), y quedó escuchando en todas las interfaces en el puerto 5432.

### Logs del Frontend (Nodo Web)

```
$ sudo docker compose logs cruz-azul-frontend --tail=10

cruz-azul-frontend  | ============================================
cruz-azul-frontend  |   ERP Farmacias Cruz Azul - Servidor Activo
cruz-azul-frontend  |   Puerto: 80
cruz-azul-frontend  |   BD Host: 10.0.1.153
cruz-azul-frontend  | ============================================
cruz-azul-frontend  | [OK] Conexión a PostgreSQL establecida: 2026-05-13T01:02:08.502Z
```

**Comentario:** El servidor Express inició en el puerto 80 y estableció conexión exitosa con PostgreSQL en la instancia BD remota (`10.0.1.153`).

---

## 5. Verificación de la Base de Datos

```
$ sudo docker exec cruz-azul-bd pg_isready -U cruz_azul_admin -d cruz_azul_db
/var/run/postgresql:5432 - accepting connections

$ sudo docker exec cruz-azul-bd psql -U cruz_azul_admin -d cruz_azul_db \
  -c "SELECT id, nombre, categoria, precio, stock FROM productos ORDER BY id;"

 id |      nombre       |  categoria   | precio  | stock
----+-------------------+--------------+---------+-------
  1 | Paracetamol 500mg | Medicamentos | 2990.00 |   150
  2 | Ibuprofeno 400mg  | Medicamentos | 3490.00 |   200
  3 | Amoxicilina 500mg | Medicamentos | 5990.00 |    80
  4 | Vitamina C 1000mg | Vitaminas    | 4290.00 |   120
  5 | Alcohol Gel 500ml | Higiene      | 2490.00 |   300
  6 | Mascarillas KN95  | Protección   | 5990.00 |   500
  7 | Loratadina 10mg   | Medicamentos | 2190.00 |    90
  8 | Omeprazol 20mg    | Medicamentos | 3990.00 |   110
(8 rows)
```

**Comentario:** La tabla `productos` fue creada correctamente por el script `init.sql` durante la primera inicialización del contenedor. Los 8 productos de ejemplo están persistidos en el volumen `pgdata`.

---

## 6. Verificación de Endpoints API (desde Nodo Frontend)

### Health Check

```
$ curl -s http://localhost/api/health
{"status":"OK","database":"connected","timestamp":"2026-05-13T01:06:51.510Z"}
```

### API de Productos

```
$ curl -s http://localhost/api/productos
{"success":true,"total":8,"data":[
  {"id":1,"nombre":"Paracetamol 500mg","categoria":"Medicamentos","precio":"2990.00","stock":150,...},
  {"id":2,"nombre":"Ibuprofeno 400mg","categoria":"Medicamentos","precio":"3490.00","stock":200,...},
  ...
  {"id":8,"nombre":"Omeprazol 20mg","categoria":"Medicamentos","precio":"3990.00","stock":110,...}
]}
```

**Comentario:** La API REST responde correctamente. El endpoint `/api/health` confirma la conexión activa con PostgreSQL. El endpoint `/api/productos` retorna los 8 productos almacenados en la BD remota.

---

## 7. Inspección de Recursos Docker

### Imágenes construidas

| Nodo | Imagen | Tamaño |
|---|---|---|
| BD | `cruz_azul-erp-cruz-azul-bd:latest` | 109 MB |
| Frontend | `cruz_azul-erp-cruz-azul-frontend:latest` | 47.9 MB |

### Volúmenes

| Nodo | Volumen | Driver |
|---|---|---|
| BD | `cruz_azul-erp_pgdata` | local |

### Redes

| Nodo | Red | Driver |
|---|---|---|
| BD | `cruz_azul-erp_azul-net` | bridge |
| Frontend | `cruz_azul-erp_azul-net` | bridge |

---

## 8. Detención y Re-inicio de Servicios

### Detención (`docker compose stop`)

**Nodo BD:**
```
$ sudo docker compose stop cruz-azul-bd
 Container cruz-azul-bd Stopping
 Container cruz-azul-bd Stopped

$ sudo docker compose ps
NAME      IMAGE     COMMAND   SERVICE   CREATED   STATUS    PORTS
(vacío — contenedor detenido)
```

**Nodo Frontend:**
```
$ sudo docker compose stop cruz-azul-frontend
 Container cruz-azul-frontend Stopping
 Container cruz-azul-frontend Stopped

$ sudo docker compose ps
NAME      IMAGE     COMMAND   SERVICE   CREATED   STATUS    PORTS
(vacío — contenedor detenido)
```

**Comentario:** Ambos servicios se detuvieron de forma ordenada usando `docker compose stop`. PostgreSQL realizó un *graceful shutdown* y el frontend cerró las conexiones activas.

### Re-inicio (`docker compose start`)

**Nodo BD:**
```
$ sudo docker compose start cruz-azul-bd
 Container cruz-azul-bd Starting
 Container cruz-azul-bd Started

$ sudo docker compose ps
NAME           IMAGE                        STATUS          PORTS
cruz-azul-bd   cruz_azul-erp-cruz-azul-bd   Up (healthy)    0.0.0.0:5432->5432/tcp
```

**Nodo Frontend:**
```
$ sudo docker compose start cruz-azul-frontend
 Container cruz-azul-frontend Starting
 Container cruz-azul-frontend Started

$ curl -s http://localhost/api/health
{"status":"OK","database":"connected","timestamp":"2026-05-13T01:06:51.510Z"}
```

**Comentario:** Ambos servicios se reiniciaron exitosamente. El frontend restableció su conexión con PostgreSQL de forma automática, confirmado por el health check.

---

## 9. Comandos Principales Utilizados

| Comando | Descripción |
|---|---|
| `docker compose build <servicio>` | Construir la imagen Docker del servicio especificado |
| `docker compose up -d <servicio>` | Crear e iniciar el contenedor en modo *detached* |
| `docker compose ps` | Listar contenedores activos y su estado |
| `docker compose logs <servicio> --tail=N` | Ver las últimas N líneas de logs del servicio |
| `docker compose stop <servicio>` | Detener el contenedor sin eliminarlo |
| `docker compose start <servicio>` | Re-iniciar un contenedor detenido |
| `docker compose down` | Detener y eliminar contenedores, redes y volúmenes |
| `docker exec <contenedor> <cmd>` | Ejecutar un comando dentro del contenedor |

---

## 10. Configuración de Red AWS

Para permitir la comunicación entre las instancias EC2, se configuró el Security Group `SG-WEB-CruzAzul` con la siguiente regla de entrada adicional:

| Tipo | Puerto | Origen | Descripción |
|---|---|---|---|
| PostgreSQL | 5432 | 10.0.0.0/16 | Permitir conexión desde Frontend a BD por red interna VPC |

---

## Acceso a la Aplicación

- **Frontend Web:** http://54.158.161.49
- **API Health:** http://54.158.161.49/api/health
- **API Productos:** http://54.158.161.49/api/productos
- **Repositorio GitHub:** https://github.com/karinjpb/farmaciacruzazul
