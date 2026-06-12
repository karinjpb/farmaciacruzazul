# ERP Farmacias Cruz Azul — v2.0 (EVA3)
## Arquitectura Multi Cloud con Autenticación MFA

Sistema ERP para gestión de productos e inventario de la cadena de Farmacias Cruz Azul, con portal de autenticación multifactor (MFA), control de acceso basado en roles (RBAC) y tokens JWT.

---

### Tecnologías

| Componente | Tecnología |
|-----------|-----------|
| Frontend | Node.js 18 + Express |
| Base de Datos | PostgreSQL 15 (Docker local / AWS RDS) |
| Autenticación | JWT + MFA (TOTP — Google Authenticator) |
| Seguridad | Helmet, bcrypt, rate limiting, auditoría |
| Contenedores | Docker + Docker Compose |
| Despliegue | AWS EC2 + RDS + S3 |

### Estructura del Proyecto

```
cruz_azul-erp/
├── frontend/
│   ├── public/
│   │   ├── index.html          ← Dashboard ERP (protegido con JWT)
│   │   ├── login.html          ← Portal de autenticación MFA
│   │   └── styles.css          ← Estilos CSS
│   ├── src/
│   │   └── server.js           ← Servidor Express + Auth + API REST
│   ├── package.json            ← Dependencias Node.js
│   └── Dockerfile              ← Imagen Docker del Frontend
├── database/
│   ├── init.sql                ← Inicialización BD (usuarios + productos + auditoría)
│   └── Dockerfile              ← Imagen Docker de PostgreSQL
├── docker-compose.yml          ← Orquestación de servicios
├── .gitignore
└── README.md
```

### Usuarios por Defecto

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin` | `CruzAzul2026!` | administrador |
| `operador` | `CruzAzul2026!` | operador |

### Despliegue Rápido (desarrollo local)

```bash
cd cruz_azul-erp
docker compose up -d --build
# Abrir http://localhost en el navegador
```

### Endpoints API

| Ruta | Método | Auth | Descripción |
|------|--------|------|-------------|
| `/` | GET | — | Portal de login |
| `/dashboard` | GET | — | Dashboard (verifica token en frontend) |
| `/api/auth/login` | POST | — | Login (paso 1: credenciales) |
| `/api/auth/mfa/verify` | POST | Temp | Login (paso 2: código MFA) |
| `/api/auth/mfa/setup` | POST | JWT | Generar QR para configurar MFA |
| `/api/auth/mfa/activate` | POST | JWT | Confirmar y activar MFA |
| `/api/auth/me` | GET | JWT | Datos del usuario autenticado |
| `/api/auth/logout` | POST | JWT | Cerrar sesión |
| `/api/productos` | GET | JWT | Listar productos |
| `/api/productos` | POST | JWT | Crear producto |
| `/api/productos/:id` | DELETE | JWT | Eliminar producto |
| `/api/health` | GET | — | Health check (público) |

---

**Asignatura:** TI3053_N5_C2 — Arquitectura Multi Cloud  
**Docente:** Marcos Pozas S. — INACAP  
**Repositorio:** https://github.com/karinjpb/farmaciacruzazul
