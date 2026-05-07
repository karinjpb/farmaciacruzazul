# ERP Farmacias Cruz Azul 💊

Sistema ERP para la gestión de productos de la cadena de Farmacias Cruz Azul.  
Arquitectura basada en microservicios dockerizados.

## Arquitectura
- **Frontend:** Node.js 18 + Express (puerto 80)
- **Backend BD:** PostgreSQL 15 (puerto 5432)
- **Red:** Bridge network `azul-net` (10.10.0.0/24)
- **Orquestación:** Docker Compose

## Despliegue rápido
```bash
docker-compose up -d --build
```

## Endpoints
| Ruta | Método | Descripción |
|------|--------|-------------|
| `/` | GET | Interfaz web ERP |
| `/api/productos` | GET | Listar productos |
| `/api/productos` | POST | Crear producto |
| `/api/productos/:id` | DELETE | Eliminar producto |
| `/api/health` | GET | Estado del servicio |

## Tecnologías
Node.js, Express, PostgreSQL, Docker, Docker Compose, AWS EC2
