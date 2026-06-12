-- ============================================
-- Script de inicialización - ERP Cruz Azul
-- Base de datos: cruz_azul_db
-- EVA3: Incluye tabla de usuarios con soporte MFA
-- ============================================

-- ============================================
-- Tabla de Usuarios con soporte MFA
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'operador',
    mfa_secret VARCHAR(255),
    mfa_habilitado BOOLEAN DEFAULT FALSE,
    intentos_fallidos INTEGER DEFAULT 0,
    cuenta_bloqueada BOOLEAN DEFAULT FALSE,
    ultimo_acceso TIMESTAMP,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabla de Sesiones / Tokens (auditoría)
-- ============================================
CREATE TABLE IF NOT EXISTS sesiones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_origen VARCHAR(45),
    user_agent TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP NOT NULL,
    activa BOOLEAN DEFAULT TRUE
);

-- ============================================
-- Tabla de Log de Auditoría
-- ============================================
CREATE TABLE IF NOT EXISTS auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(100) NOT NULL,
    detalle TEXT,
    ip_origen VARCHAR(45),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabla de Productos (existente)
-- ============================================
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100) NOT NULL,
    precio NUMERIC(10,2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    proveedor VARCHAR(150),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Índices para rendimiento
-- ============================================
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha);

-- ============================================
-- Insertar usuario administrador por defecto
-- Password: CruzAzul2026! (bcrypt hash)
-- ============================================
INSERT INTO usuarios (username, email, password_hash, rol, mfa_habilitado)
VALUES (
    'admin',
    'admin@cruzazul.cl',
    '$2a$10$8K1p/acOvFkTZf2LJnzJhOY5YPfRnXJVrWJ3G9QhNvFmKxY5xQZPa',
    'administrador',
    FALSE
) ON CONFLICT (username) DO NOTHING;

-- Insertar usuario operador de ejemplo
INSERT INTO usuarios (username, email, password_hash, rol, mfa_habilitado)
VALUES (
    'operador',
    'operador@cruzazul.cl',
    '$2a$10$8K1p/acOvFkTZf2LJnzJhOY5YPfRnXJVrWJ3G9QhNvFmKxY5xQZPa',
    'operador',
    FALSE
) ON CONFLICT (username) DO NOTHING;

-- ============================================
-- Insertar datos iniciales de productos
-- ============================================
INSERT INTO productos (nombre, descripcion, categoria, precio, stock, proveedor) VALUES
('Paracetamol 500mg', 'Analgésico y antipirético - Caja 20 comprimidos', 'Medicamentos', 2990, 150, 'Laboratorio Chile'),
('Ibuprofeno 400mg', 'Antiinflamatorio no esteroidal - Caja 10 comprimidos', 'Medicamentos', 3490, 200, 'Laboratorio Bagó'),
('Amoxicilina 500mg', 'Antibiótico de amplio espectro - Caja 21 cápsulas', 'Medicamentos', 5990, 80, 'Laboratorio Saval'),
('Vitamina C 1000mg', 'Suplemento vitamínico efervescente - Tubo 10 comprimidos', 'Vitaminas', 4290, 120, 'Bayer Chile'),
('Alcohol Gel 500ml', 'Desinfectante de manos con aloe vera', 'Higiene', 2490, 300, 'Proveedor Nacional'),
('Mascarillas KN95', 'Mascarillas de protección respiratoria - Caja 10 unidades', 'Protección', 5990, 500, 'Importadora MedPro'),
('Loratadina 10mg', 'Antihistamínico - Caja 10 comprimidos', 'Medicamentos', 2190, 90, 'Laboratorio Andrómaco'),
('Omeprazol 20mg', 'Inhibidor de bomba de protones - Caja 14 cápsulas', 'Medicamentos', 3990, 110, 'Laboratorio Chile')
ON CONFLICT DO NOTHING;
