const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Conexión a PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST || 'cruz-azul-bd',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'cruz_azul_db',
    user: process.env.DB_USER || 'cruz_azul_admin',
    password: process.env.DB_PASSWORD || 'CruzAzul2026!',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

pool.query('SELECT NOW()')
    .then(res => console.log('[OK] Conexión a PostgreSQL establecida:', res.rows[0].now))
    .catch(err => console.error('[ERROR] No se pudo conectar a PostgreSQL:', err.message));

// ===== RUTAS API REST =====

// GET /api/productos — Listar todos
app.get('/api/productos', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM productos ORDER BY id ASC');
        res.json({ success: true, total: resultado.rows.length, data: resultado.rows });
    } catch (error) {
        console.error('[ERROR] GET /api/productos:', error.message);
        res.status(500).json({ success: false, error: 'Error al consultar productos' });
    }
});

// POST /api/productos — Crear nuevo
app.post('/api/productos', async (req, res) => {
    try {
        const { nombre, descripcion, categoria, precio, stock, proveedor } = req.body;
        if (!nombre || !categoria || !precio) {
            return res.status(400).json({ success: false, error: 'Campos obligatorios: nombre, categoria, precio' });
        }
        const resultado = await pool.query(
            `INSERT INTO productos (nombre, descripcion, categoria, precio, stock, proveedor)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [nombre, descripcion || '', categoria, precio, stock || 0, proveedor || '']
        );
        res.status(201).json({ success: true, message: 'Producto creado exitosamente', data: resultado.rows[0] });
    } catch (error) {
        console.error('[ERROR] POST /api/productos:', error.message);
        res.status(500).json({ success: false, error: 'Error al crear producto' });
    }
});

// DELETE /api/productos/:id — Eliminar
app.delete('/api/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING *', [id]);
        if (resultado.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado' });
        }
        res.json({ success: true, message: 'Producto eliminado', data: resultado.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al eliminar producto' });
    }
});

// GET /api/health — Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'OK', database: 'connected', timestamp: new Date() });
    } catch (error) {
        res.status(503).json({ status: 'ERROR', database: 'disconnected' });
    }
});

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log('============================================');
    console.log('  ERP Farmacias Cruz Azul - Servidor Activo');
    console.log('  Puerto: ' + PORT);
    console.log('  BD Host: ' + (process.env.DB_HOST || 'cruz-azul-bd'));
    console.log('============================================');
});
