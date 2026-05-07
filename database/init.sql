-- ============================================
-- Script de inicialización - ERP Cruz Azul
-- Base de datos: cruz_azul_db
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

-- Insertar datos iniciales de ejemplo
INSERT INTO productos (nombre, descripcion, categoria, precio, stock, proveedor) VALUES
('Paracetamol 500mg', 'Analgésico y antipirético - Caja 20 comprimidos', 'Medicamentos', 2990, 150, 'Laboratorio Chile'),
('Ibuprofeno 400mg', 'Antiinflamatorio no esteroidal - Caja 10 comprimidos', 'Medicamentos', 3490, 200, 'Laboratorio Bagó'),
('Amoxicilina 500mg', 'Antibiótico de amplio espectro - Caja 21 cápsulas', 'Medicamentos', 5990, 80, 'Laboratorio Saval'),
('Vitamina C 1000mg', 'Suplemento vitamínico efervescente - Tubo 10 comprimidos', 'Vitaminas', 4290, 120, 'Bayer Chile'),
('Alcohol Gel 500ml', 'Desinfectante de manos con aloe vera', 'Higiene', 2490, 300, 'Proveedor Nacional'),
('Mascarillas KN95', 'Mascarillas de protección respiratoria - Caja 10 unidades', 'Protección', 5990, 500, 'Importadora MedPro'),
('Loratadina 10mg', 'Antihistamínico - Caja 10 comprimidos', 'Medicamentos', 2190, 90, 'Laboratorio Andrómaco'),
('Omeprazol 20mg', 'Inhibidor de bomba de protones - Caja 14 cápsulas', 'Medicamentos', 3990, 110, 'Laboratorio Chile');

CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);
