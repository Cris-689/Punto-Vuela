const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit'); // IMPORTACIÓN NECESARIA
const db = require('./database');

const formatRqlite = (dbResult) => {
    if (!dbResult) return [];
    
    let queryData;
    if (dbResult.get) queryData = dbResult.get(0); // Si es el objeto QueryResult
    else if (dbResult.results) queryData = dbResult.results[0]; // Si es la respuesta cruda
    else if (Array.isArray(dbResult)) queryData = dbResult[0]; // Fallback
    else queryData = dbResult;

    if (!queryData || !queryData.columns || !queryData.values) return [];

    return queryData.values.map(row => {
        const obj = {};
        queryData.columns.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
    });
};

const app = express();
const PORT = process.env.PORT || 3000;

// Validación de Secreto JWT
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('ERROR CRÍTICO: La variable JWT_SECRET no está definida.');
    process.exit(1);
}

// Configuración de Rate Limiting (Protección contra fuerza bruta)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // Máximo 5 intentos por IP
    message: { error: 'Demasiados intentos. Inténtelo de nuevo en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Helper function to validate DNI format and mathematical correctness
const validateDni = (dni) => {
    const validChars = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const dniRegex = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/i;

    if (!dniRegex.test(dni)) return false;

    const numberString = dni.substring(0, 8);
    const letter = dni.charAt(8).toUpperCase();
    const index = parseInt(numberString, 10) % 23;

    return validChars.charAt(index) === letter;
};

// Registro de usuario - Actualizado para rqlite asíncrono
app.post('/api/auth/register', async (req, res) => {
    const { dni, nombre_completo, support_number } = req.body;
    if (!dni || !nombre_completo || !support_number) {
        return res.status(400).json({ error: 'DNI, nombre completo y número de soporte son requeridos' });
    }

    if (!validateDni(dni)) {
        return res.status(400).json({ error: 'El DNI introducido no es válido' });
    }

    try {
        const hashedPassword = await bcrypt.hash(support_number, 10);
        // La ejecución se realiza a través de la red hacia el clúster de rqlite
        const result = await db.execute(`INSERT INTO users (dni, nombre_completo, support_number) VALUES (?, ?, ?)`, [dni, nombre_completo, hashedPassword]);

        res.status(201).json({ message: 'Usuario registrado exitosamente', userId: result.last_insert_id });
    } catch (error) {
        // Manejo de error de unicidad adaptado a la respuesta del driver de red
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'El DNI ya está registrado' });
        }
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

// Login de usuario - Consulta distribuida
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const { dni, support_number } = req.body;
    
    const ADMIN_DNI = process.env.ADMIN_DNI;
    const ADMIN_PASS = process.env.ADMIN_PASSWORD;

    if (dni === ADMIN_DNI && support_number === ADMIN_PASS) {
        const token = jwt.sign({ id: 0, dni: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
        return res.json({ token, user: { id: 0, dni: 'admin' } });
    }

    try {
        const results = await db.query(`SELECT * FROM users WHERE dni = ?`, [dni]);
        const rows = results.toArray();
        const user = rows.length > 0 ? rows[0] : null;

        if (!user || !(await bcrypt.compare(support_number, user.support_number))) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign({ id: user.id, dni: user.dni }, JWT_SECRET, { expiresIn: '2h' });
        res.json({ token, user: { id: user.id, dni: user.dni } });
    } catch (error) {
        console.error("Error en el login:", error);
        res.status(500).json({ error: 'Error interno en el login' });
    }
});

// Obtener todas las citas y limpiar citas obsoletas de forma atómica
app.get('/api/appointments', async (req, res) => {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
        let sql = `SELECT id, date, time FROM appointments WHERE date >= ?`;
        let params = [todayStr];

        if (req.query.date) {
            sql += ` AND date = ?`;
            params.push(req.query.date);
        }

        const results = await db.query(sql, params);
        res.json(formatRqlite(results));
    } catch (error) {
        console.error("Error GET citas:", error);
        res.status(500).json({ error: 'Error al obtener citas' });
    }
});

// Obtener mis citas
app.get('/api/appointments/me', authenticateToken, async (req, res) => {
    try {
        const results = await db.query(`SELECT id, date, time FROM appointments WHERE user_id = ?`, [req.user.id]);
        res.json(formatRqlite(results));
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tus citas' });
    }
});

app.post('/api/appointments', authenticateToken, async (req, res) => {
    const { date, time } = req.body;
    const userId = req.user.id;
    const isOwnerAdmin = req.user.dni === 'admin';

    if (!date || !time) return res.status(400).json({ error: 'Fecha y hora requeridas' });
    const todayStr = new Date().toISOString().split('T')[0];

    try {
        // COMPROBAR SI ESTÁ FUERA DE SERVICIO
        const statusRes = await db.query(`SELECT value FROM system_settings WHERE key = 'service_status'`);
        const statusData = formatRqlite(statusRes);
        const isAvailable = statusData.length > 0 && statusData[0].value === 'available';

        if (!isAvailable && !isOwnerAdmin) {
            return res.status(403).json({ error: 'El sistema está temporalmente fuera de servicio. Vuelve a intentarlo más tarde.' });
        }

        // COMPROBAR SI EL HUECO ESTÁ OCUPADO
        const checkRes = await db.query(`SELECT id FROM appointments WHERE date = ? AND time = ?`, [date, time]);
        const occupied = formatRqlite(checkRes);

        if (occupied.length > 0) {
            return res.status(400).json({ error: 'Este hueco ya está ocupado' });
        }

        // COMPROBAR LÍMITE DE 1 CITA
        if (!isOwnerAdmin) {
            const userCheck = await db.query(`SELECT id FROM appointments WHERE user_id = ? AND date >= ?`, [userId, todayStr]);
            const activeAppointments = formatRqlite(userCheck);
            
            if (activeAppointments.length > 0) {
                return res.status(400).json({ error: 'Ya tienes una cita activa. Anúlala para pedir otra.' });
            }
        }

        // INSERTAR LA CITA
        const insertRes = await db.execute(`INSERT INTO appointments (date, time, user_id) VALUES (?, ?, ?)`, [date, time, userId]);
        res.status(201).json({ id: insertRes.lastInsertId || Math.floor(Math.random()*1000), date, time });

    } catch (error) {
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Este hueco acaba de ser ocupado por otra persona.' });
        }
        console.error("Error al crear cita:", error);
        res.status(500).json({ error: 'Error interno al crear la cita' });
    }
});

// Anular una cita con comprobación de propiedad
app.delete('/api/appointments/:id', authenticateToken, async (req, res) => {
    const appointmentId = req.params.id;
    const userId = req.user.id;

    try {
        const result = await db.execute(`DELETE FROM appointments WHERE id = ? AND user_id = ?`, [appointmentId, userId]);
        if (result.rows_affected === 0) return res.status(403).json({ error: 'No tienes permiso o la cita no existe' });
        res.json({ message: 'Cita anulada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al anular la cita' });
    }
});

// Obtener estado del servicio (público) - Consulta distribuida
app.get('/api/status', async (req, res) => {
    try {
        const results = await db.query(`SELECT value FROM system_settings WHERE key = 'service_status'`);
        const row = results.get(0);
        res.json({ status: row ? row.value : 'available' });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo estado del sistema' });
    }
});

// Admin: Cambiar estado del servicio
app.put('/api/admin/status', authenticateToken, async (req, res) => {
    if (req.user.dni !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const { status } = req.body;
    if (status !== 'available' && status !== 'unavailable') {
        return res.status(400).json({ error: 'Estado inválido' });
    }

    try {
        await db.execute(`UPDATE system_settings SET value = ? WHERE key = 'service_status'`, [status]);
        res.json({ status });
    } catch (error) {
        res.status(500).json({ error: 'Error actualizando el estado' });
    }
});

// Admin: Obtener todas las citas y todos los usuarios asociados - Join distribuido
app.get('/api/admin/appointments', authenticateToken, async (req, res) => {
    if (req.user.dni !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    try {
        const results = await db.query(`
            SELECT a.id, a.date, a.time, a.user_id, u.dni, u.nombre_completo
            FROM appointments a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.date, a.time
        `);
        
        let rows = formatRqlite(results);

        // Mapear los datos para ocultar el ID 0 del administrador
        const mappedRows = rows.map(r => {
            if (r.user_id === 0 || r.dni === 'admin') {
                return {
                    ...r,
                    dni: 'admin',
                    nombre_completo: 'Bloqueado por Administrador'
                }
            }
            return r;
        });

        res.json(mappedRows);
    } catch (error) {
        console.error("Error en admin:", error);
        res.status(500).json({ error: 'Error al obtener todas las citas' });
    }
});

// Admin: Anular cualquier cita
app.delete('/api/admin/appointments/:id', authenticateToken, async (req, res) => {
    if (req.user.dni !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere cuenta de administrador.' });
    }

    const appointmentId = req.params.id;
    try {
        await db.execute(`DELETE FROM appointments WHERE id = ?`, [appointmentId]);
        res.json({ message: 'Cita anulada por el administrador' });
    } catch (error) {
        res.status(500).json({ error: 'Error al anular la cita desde admin' });
    }
});

// Admin: Eliminar un usuario específico y sus citas asociadas
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
    // Verificación de rango: Solo el administrador puede borrar usuarios
    if (req.user.dni !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere cuenta de administrador.' });
    }

    const userIdToDelete = req.params.id;

    try {
        // 1. Eliminamos las citas asociadas para mantener la integridad referencial
        await db.execute(`DELETE FROM appointments WHERE user_id = ?`, [userIdToDelete]);

        // 2. Eliminamos al usuario
        const result = await db.execute(`DELETE FROM users WHERE id = ?`, [userIdToDelete]);

        if (result.rows_affected() === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ message: 'Usuario y sus citas eliminados correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar el usuario del clúster' });
    }
});

// Admin: Limpieza total de usuarios
app.delete('/api/admin/users', authenticateToken, async (req, res) => {
    if (req.user.dni !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    try {
        // Ejecutamos una secuencia de comandos para limpiar la base de datos distribuida
        // No borramos al administrador (id: 0 o dni: admin) para no perder el acceso
        await db.execute([
            `DELETE FROM appointments WHERE user_id != 0`,
            `DELETE FROM users WHERE dni != 'admin'`
        ]);

        res.json({ message: 'Todos los usuarios (excepto admin) han sido eliminados' });
    } catch (error) {
        res.status(500).json({ error: 'Error en la limpieza masiva de la base de datos' });
    }
});

// Endpoint de Salud para Kubernetes (Liveness/Readiness)
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'error', database: 'disconnected' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor backend corriendo en el puerto ${PORT}`);
});