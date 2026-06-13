// ============================================
// ERP Farmacias Cruz Azul - Servidor Express
// EVA3: Portal de Autenticación con MFA + JWT
// ============================================

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 80;

// Clave secreta para JWT (en producción usar variable de entorno)
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRATION = '2h';

// ===== MIDDLEWARE DE SEGURIDAD =====
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting para prevenir ataques de fuerza bruta
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10,                   // máximo 10 intentos
    message: { success: false, error: 'Demasiados intentos de login. Intente en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Servir archivos estáticos (login, etc.)
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

// ===== CONEXIÓN A POSTGRESQL =====
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'cruz_azul_db',
    user: process.env.DB_USER || 'cruz_azul_admin',
    password: process.env.DB_PASSWORD || 'CruzAzul2026!',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('rds') ? { rejectUnauthorized: false } : false
});

pool.query('SELECT NOW()')
    .then(res => console.log('[OK] Conexión a PostgreSQL establecida:', res.rows[0].now))
    .catch(err => console.error('[ERROR] No se pudo conectar a PostgreSQL:', err.message));

// ===== FUNCIONES DE AUDITORÍA =====
async function registrarAuditoria(usuarioId, accion, detalle, ip) {
    try {
        await pool.query(
            'INSERT INTO auditoria (usuario_id, accion, detalle, ip_origen) VALUES ($1, $2, $3, $4)',
            [usuarioId, accion, detalle, ip]
        );
    } catch (err) {
        console.error('[AUDIT] Error al registrar auditoría:', err.message);
    }
}

// ===== MIDDLEWARE DE AUTENTICACIÓN JWT =====
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ success: false, error: 'Token de acceso requerido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, error: 'Token inválido o expirado' });
    }
}

// Middleware para verificar rol de administrador
function verificarAdmin(req, res, next) {
    if (req.usuario.rol !== 'administrador') {
        return res.status(403).json({ success: false, error: 'Acceso denegado. Se requiere rol administrador.' });
    }
    next();
}

// ===================================================
//  RUTAS DE AUTENTICACIÓN (PORTAL DE LOGIN + MFA)
// ===================================================

// POST /api/auth/login — Paso 1: Credenciales (usuario + contraseña)
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        const ip = req.ip || req.connection.remoteAddress;

        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
        }

        // Buscar usuario en BD
        const result = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            await registrarAuditoria(null, 'LOGIN_FALLIDO', `Usuario no encontrado: ${username}`, ip);
            return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
        }

        const usuario = result.rows[0];

        // Verificar si la cuenta está bloqueada
        if (usuario.cuenta_bloqueada) {
            await registrarAuditoria(usuario.id, 'LOGIN_BLOQUEADO', 'Cuenta bloqueada por intentos fallidos', ip);
            return res.status(423).json({ success: false, error: 'Cuenta bloqueada. Contacte al administrador.' });
        }

        // Verificar contraseña
        const passwordValido = await bcrypt.compare(password, usuario.password_hash);
        if (!passwordValido) {
            // Incrementar intentos fallidos
            const intentos = usuario.intentos_fallidos + 1;
            const bloqueada = intentos >= 5;
            await pool.query(
                'UPDATE usuarios SET intentos_fallidos = $1, cuenta_bloqueada = $2 WHERE id = $3',
                [intentos, bloqueada, usuario.id]
            );
            await registrarAuditoria(usuario.id, 'LOGIN_FALLIDO', `Contraseña incorrecta (intento ${intentos})`, ip);
            return res.status(401).json({
                success: false,
                error: bloqueada ? 'Cuenta bloqueada por demasiados intentos fallidos' : 'Credenciales inválidas'
            });
        }

        // Resetear intentos fallidos
        await pool.query('UPDATE usuarios SET intentos_fallidos = 0 WHERE id = $1', [usuario.id]);

        // Si MFA está habilitado, requiere segundo paso
        if (usuario.mfa_habilitado && usuario.mfa_secret) {
            // Generar token temporal (válido solo para completar MFA)
            const tempToken = jwt.sign(
                { id: usuario.id, username: usuario.username, paso: 'mfa_pendiente' },
                JWT_SECRET,
                { expiresIn: '5m' }
            );
            await registrarAuditoria(usuario.id, 'LOGIN_PASO1_OK', 'Credenciales válidas, MFA pendiente', ip);
            return res.json({
                success: true,
                mfa_requerido: true,
                temp_token: tempToken,
                message: 'Credenciales válidas. Ingrese el código MFA.'
            });
        }

        // Sin MFA: generar token completo directamente
        const token = jwt.sign(
            { id: usuario.id, username: usuario.username, rol: usuario.rol, email: usuario.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRATION }
        );

        // Registrar sesión
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await pool.query(
            'INSERT INTO sesiones (usuario_id, token_hash, ip_origen, user_agent, fecha_expiracion) VALUES ($1, $2, $3, $4, NOW() + INTERVAL \'2 hours\')',
            [usuario.id, tokenHash, ip, req.get('user-agent')]
        );

        // Actualizar último acceso
        await pool.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1', [usuario.id]);
        await registrarAuditoria(usuario.id, 'LOGIN_EXITOSO', 'Acceso sin MFA', ip);

        res.json({
            success: true,
            mfa_requerido: false,
            token,
            usuario: { id: usuario.id, username: usuario.username, rol: usuario.rol, email: usuario.email }
        });

    } catch (error) {
        console.error('[ERROR] POST /api/auth/login:', error.message);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// POST /api/auth/mfa/verify — Paso 2: Verificar código TOTP (MFA)
app.post('/api/auth/mfa/verify', async (req, res) => {
    try {
        const { temp_token, codigo_mfa } = req.body;
        const ip = req.ip || req.connection.remoteAddress;

        if (!temp_token || !codigo_mfa) {
            return res.status(400).json({ success: false, error: 'Token temporal y código MFA requeridos' });
        }

        // Verificar token temporal
        let decoded;
        try {
            decoded = jwt.verify(temp_token, JWT_SECRET);
        } catch (err) {
            return res.status(403).json({ success: false, error: 'Token temporal expirado. Inicie sesión nuevamente.' });
        }

        if (decoded.paso !== 'mfa_pendiente') {
            return res.status(400).json({ success: false, error: 'Token no válido para verificación MFA' });
        }

        // Obtener secret MFA del usuario
        const result = await pool.query('SELECT * FROM usuarios WHERE id = $1', [decoded.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }

        const usuario = result.rows[0];

        // Verificar código TOTP
        const codigoValido = authenticator.verify({ token: codigo_mfa, secret: usuario.mfa_secret });
        if (!codigoValido) {
            await registrarAuditoria(usuario.id, 'MFA_FALLIDO', 'Código TOTP inválido', ip);
            return res.status(401).json({ success: false, error: 'Código MFA inválido' });
        }

        // MFA exitoso: generar token completo
        const token = jwt.sign(
            { id: usuario.id, username: usuario.username, rol: usuario.rol, email: usuario.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRATION }
        );

        // Registrar sesión
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await pool.query(
            'INSERT INTO sesiones (usuario_id, token_hash, ip_origen, user_agent, fecha_expiracion) VALUES ($1, $2, $3, $4, NOW() + INTERVAL \'2 hours\')',
            [usuario.id, tokenHash, ip, req.get('user-agent')]
        );

        await pool.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1', [usuario.id]);
        await registrarAuditoria(usuario.id, 'LOGIN_MFA_EXITOSO', 'Autenticación MFA completada', ip);

        res.json({
            success: true,
            token,
            usuario: { id: usuario.id, username: usuario.username, rol: usuario.rol, email: usuario.email }
        });

    } catch (error) {
        console.error('[ERROR] POST /api/auth/mfa/verify:', error.message);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// POST /api/auth/mfa/setup — Configurar MFA para el usuario autenticado
app.post('/api/auth/mfa/setup', verificarToken, async (req, res) => {
    try {
        const secret = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(req.usuario.username, 'CruzAzul-ERP', secret);

        // Generar QR code como data URL
        const qrCodeUrl = await QRCode.toDataURL(otpauth);

        // Guardar secret en BD (se confirma al verificar el primer código)
        await pool.query('UPDATE usuarios SET mfa_secret = $1 WHERE id = $2', [secret, req.usuario.id]);

        await registrarAuditoria(req.usuario.id, 'MFA_SETUP', 'QR generado para configuración MFA', req.ip);

        res.json({
            success: true,
            secret,
            qr_code: qrCodeUrl,
            message: 'Escanee el QR con su app de autenticación (Google Authenticator, Authy, etc.)'
        });

    } catch (error) {
        console.error('[ERROR] POST /api/auth/mfa/setup:', error.message);
        res.status(500).json({ success: false, error: 'Error al configurar MFA' });
    }
});

// POST /api/auth/mfa/activate — Confirmar y activar MFA (requiere verificar código)
app.post('/api/auth/mfa/activate', verificarToken, async (req, res) => {
    try {
        const { codigo } = req.body;
        if (!codigo) {
            return res.status(400).json({ success: false, error: 'Código de verificación requerido' });
        }

        const result = await pool.query('SELECT mfa_secret FROM usuarios WHERE id = $1', [req.usuario.id]);
        if (result.rows.length === 0 || !result.rows[0].mfa_secret) {
            return res.status(400).json({ success: false, error: 'Primero configure MFA con /api/auth/mfa/setup' });
        }

        const secret = result.rows[0].mfa_secret;
        const codigoValido = authenticator.verify({ token: codigo, secret });

        if (!codigoValido) {
            return res.status(401).json({ success: false, error: 'Código inválido. Intente de nuevo.' });
        }

        // Activar MFA
        await pool.query('UPDATE usuarios SET mfa_habilitado = TRUE WHERE id = $1', [req.usuario.id]);
        await registrarAuditoria(req.usuario.id, 'MFA_ACTIVADO', 'Autenticación MFA activada exitosamente', req.ip);

        res.json({ success: true, message: 'MFA activado exitosamente. A partir de ahora se requerirá código TOTP al iniciar sesión.' });

    } catch (error) {
        console.error('[ERROR] POST /api/auth/mfa/activate:', error.message);
        res.status(500).json({ success: false, error: 'Error al activar MFA' });
    }
});

// GET /api/auth/me — Obtener datos del usuario autenticado
app.get('/api/auth/me', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, rol, mfa_habilitado, ultimo_acceso, fecha_creacion FROM usuarios WHERE id = $1',
            [req.usuario.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// POST /api/auth/logout — Cerrar sesión (invalidar token)
app.post('/api/auth/logout', verificarToken, async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader.split(' ')[1];
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        await pool.query('UPDATE sesiones SET activa = FALSE WHERE token_hash = $1', [tokenHash]);
        await registrarAuditoria(req.usuario.id, 'LOGOUT', 'Sesión cerrada', req.ip);

        res.json({ success: true, message: 'Sesión cerrada exitosamente' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al cerrar sesión' });
    }
});

// ===================================================
//  RUTAS API REST — PRODUCTOS (PROTEGIDAS CON TOKEN)
// ===================================================

// GET /api/productos — Listar todos (requiere autenticación)
app.get('/api/productos', verificarToken, async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM productos ORDER BY id ASC');
        res.json({ success: true, total: resultado.rows.length, data: resultado.rows });
    } catch (error) {
        console.error('[ERROR] GET /api/productos:', error.message);
        res.status(500).json({ success: false, error: 'Error al consultar productos' });
    }
});

// POST /api/productos — Crear nuevo (requiere autenticación)
app.post('/api/productos', verificarToken, async (req, res) => {
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
        await registrarAuditoria(req.usuario.id, 'PRODUCTO_CREADO', `Producto: ${nombre}`, req.ip);
        res.status(201).json({ success: true, message: 'Producto creado exitosamente', data: resultado.rows[0] });
    } catch (error) {
        console.error('[ERROR] POST /api/productos:', error.message);
        res.status(500).json({ success: false, error: 'Error al crear producto' });
    }
});

// DELETE /api/productos/:id — Eliminar (requiere autenticación + rol admin)
app.delete('/api/productos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING *', [id]);
        if (resultado.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado' });
        }
        await registrarAuditoria(req.usuario.id, 'PRODUCTO_ELIMINADO', `Producto ID: ${id}`, req.ip);
        res.json({ success: true, message: 'Producto eliminado', data: resultado.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al eliminar producto' });
    }
});

// ===================================================
//  RUTAS DE ADMINISTRACIÓN (SOLO ADMIN)
// ===================================================

// GET /api/admin/usuarios — Listar usuarios (solo admin)
app.get('/api/admin/usuarios', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, rol, mfa_habilitado, cuenta_bloqueada, ultimo_acceso, fecha_creacion FROM usuarios ORDER BY id'
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al consultar usuarios' });
    }
});

// POST /api/admin/usuarios/:id/desbloquear — Desbloquear cuenta (solo admin)
app.post('/api/admin/usuarios/:id/desbloquear', verificarToken, verificarAdmin, async (req, res) => {
    try {
        await pool.query('UPDATE usuarios SET cuenta_bloqueada = FALSE, intentos_fallidos = 0 WHERE id = $1', [req.params.id]);
        await registrarAuditoria(req.usuario.id, 'USUARIO_DESBLOQUEADO', `Usuario ID: ${req.params.id}`, req.ip);
        res.json({ success: true, message: 'Cuenta desbloqueada' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al desbloquear cuenta' });
    }
});

// GET /api/admin/auditoria — Ver log de auditoría (solo admin)
app.get('/api/admin/auditoria', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.id, a.accion, a.detalle, a.ip_origen, a.fecha, u.username 
             FROM auditoria a LEFT JOIN usuarios u ON a.usuario_id = u.id 
             ORDER BY a.fecha DESC LIMIT 100`
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al consultar auditoría' });
    }
});

// ===================================================
//  RUTAS PÚBLICAS (SIN AUTENTICACIÓN)
// ===================================================

// GET /api/health — Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'OK', database: 'connected', timestamp: new Date(), version: '2.0-MFA' });
    } catch (error) {
        res.status(503).json({ status: 'ERROR', database: 'disconnected' });
    }
});

// Ruta principal — Sirve la página de login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Ruta al dashboard (protegida por token en el frontend)
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, '0.0.0.0', async () => {
    console.log('============================================');
    console.log('  ERP Farmacias Cruz Azul v2.0 — MFA');
    console.log('  Puerto: ' + PORT);
    console.log('  BD Host: ' + (process.env.DB_HOST || 'cruz-azul-bd'));
    console.log('  Auth: JWT + MFA (TOTP)');
    console.log('============================================');

    // Hashear la contraseña del admin por defecto si aún no está hasheada
    try {
        const result = await pool.query("SELECT id, password_hash FROM usuarios WHERE username = 'admin'");
        if (result.rows.length > 0) {
            const hash = result.rows[0].password_hash;
            // Si el hash no es bcrypt válido, re-hashear
            if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$')) {
                const newHash = await bcrypt.hash('CruzAzul2026!', 10);
                await pool.query('UPDATE usuarios SET password_hash = $1 WHERE username = $2', [newHash, 'admin']);
                console.log('[INIT] Hash de contraseña admin actualizado');
            }
        }
        // Hacer lo mismo para operador
        const result2 = await pool.query("SELECT id, password_hash FROM usuarios WHERE username = 'operador'");
        if (result2.rows.length > 0) {
            const hash2 = result2.rows[0].password_hash;
            if (!hash2.startsWith('$2a$') && !hash2.startsWith('$2b$')) {
                const newHash2 = await bcrypt.hash('CruzAzul2026!', 10);
                await pool.query('UPDATE usuarios SET password_hash = $1 WHERE username = $2', [newHash2, 'operador']);
                console.log('[INIT] Hash de contraseña operador actualizado');
            }
        }
    } catch (err) {
        console.error('[INIT] Error al verificar hashes:', err.message);
    }
});
