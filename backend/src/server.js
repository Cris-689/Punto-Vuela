const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit'); // IMPORTACIÓN NECESARIA
const db = require('./database');

const parseRqlite = (resultObj) => {
    const data = resultObj.get(0);
    if (!data || !data.values) return []; // Si no hay valores, devuelve array vacío
    return data.values.map(row => {
        let obj = {};
        data.columns.forEach((col, i) => { obj[col] = row[i]; });
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

// Función para convertir resultados de rqlite a objetos de Javascript
const parseRqliteRows = (resultData) => {
    if (!resultData.values || !resultData.columns) return [];
    return resultData.values.map(rowArray => {
        const rowObj = {};
        resultData.columns.forEach((colName, index) => {
            rowObj[colName] = rowArray[index];
        });
        return rowObj;
    });
};

// Login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const { dni, support_number } = req.body;
    const ADMIN_DNI = process.env.ADMIN_DNI;
    const ADMIN_PASS = process.env.ADMIN_PASSWORD;

    if (dni === ADMIN_DNI && support_number === ADMIN_PASS) {
        const token = jwt.sign({ id: 0, dni: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
        return res.json({ token, user: { id: 0, dni: 'admin' } });
    }

    try {
        const users = await db.query(`SELECT * FROM users WHERE dni = ?`, [dni]);
        const user = users[0]; // Ya podemos acceder directamente como un array normal

        if (!user || !(await bcrypt.compare(support_number, user.support_number))) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign({ id: user.id, dni: user.dni }, JWT_SECRET, { expiresIn: '2h' });
        res.json({ token, user: { id: user.id, dni: user.dni } });
    } catch (error) {
        res.status(500).json({ error: 'Error interno en el login' });
    }
});

// GET Todas las citas
app.get('/api/appointments', async (req, res) => {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
        await db.execute(`DELETE FROM appointments WHERE date < ?`, [todayStr]);
        const { date } = req.query;
        let sql = `SELECT id, date, time FROM appointments`;
        let params = [];
        if (date) { sql += ` WHERE date = ?`; params.push(date); }
        
        const results = await db.query(sql, params);
        res.json(results); // Se envía directamente al frontend
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener citas' });
    }
});

// GET Mis citas
app.get('/api/appointments/me', authenticateToken, async (req, res) => {
    try {
        const results = await db.query(`SELECT id, date, time FROM appointments WHERE user_id = ?`, [req.user.id]);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tus citas' });
    }
});

// POST Crear cita (con validación real de 1 cita máxima)
app.post('/api/appointments', authenticateToken, async (req, res) => {
    const { date, time } = req.body;
    const userId = req.user.id;
    const isOwnerAdmin = req.user.dni === 'admin';

    if (!date || !time) return res.status(400).json({ error: 'Fecha y hora requeridas' });
    const todayStr = new Date().toISOString().split('T')[0];

    const insertAppointment = async () => {
        try {
            const occupied = await db.query(`SELECT id FROM appointments WHERE date = ? AND time = ?`, [date, time]);
            if (occupied.length > 0) return res.status(400).json({ error: 'Este hueco ya está ocupado' });

            const insertRes = await db.execute(`INSERT INTO appointments (date, time, user_id) VALUES (?, ?, ?)`, [date, time, userId]);
            res.status(201).json({ id: insertRes.last_insert_id || Math.floor(Math.random()*1000), date, time });
        } catch (error) {
            if (error.message && error.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Este hueco acaba de ser ocupado.' });
            }
            res.status(500).json({ error: 'Error al crear la cita' });
        }
    };

    if (isOwnerAdmin) return await insertAppointment();

    try {
        // Validación de límite de citas
        const activeAppointments = await db.query(`SELECT id FROM appointments WHERE user_id = ? AND date >= ?`, [userId, todayStr]);
        if (activeAppointments.length > 0) {
            return res.status(400).json({ error: 'Ya tienes una cita activa. Anúlala para pedir otra.' });
        }
        await insertAppointment();
    } catch (error) {
        res.status(500).json({ error: 'Error interno verificando usuario' });
    }
});

// GET Estado
app.get('/api/status', async (req, res) => {
    try {
        const results = await db.query(`SELECT value FROM system_settings WHERE key = 'service_status'`);
        res.json({ status: results[0] ? results[0].value : 'available' });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo estado' });
    }
});

// GET Admin Appointments
app.get('/api/admin/appointments', authenticateToken, async (req, res) => {
    if (req.user.dni !== 'admin') return res.status(403).json({ error: 'Acceso denegado.' });

    try {
        const rows = await db.query(`
            SELECT a.id, a.date, a.time, a.user_id, u.dni, u.nombre_completo, u.support_number
            FROM appointments a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.date, a.time
        `);
        
        const mappedRows = rows.map(r => {
            if (r.user_id === 0 || r.dni === 'admin') {
                return { ...r, dni: 'admin', nombre_completo: 'Bloqueado por Administrador' };
            }
            return r;
        });

        res.json(mappedRows);
    } catch (error) {
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