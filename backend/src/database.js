const { rqlite } = require('rqlite-js');

// Se utiliza la URL del servicio de Kubernetes o una por defecto para desarrollo local
const dbUrl = process.env.DB_URL;
const client = new rqlite(dbUrl);

const initDb = async () => {
    try {
        // En rqlite enviamos un array de comandos SQL para que se ejecuten de forma atómica
        await client.execute([
            // Tabla de usuarios
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dni TEXT UNIQUE,
                nombre_completo TEXT,
                support_number TEXT
            )`,
            // Tabla de citas con clave foránea
            `CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                time TEXT,
                user_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,
            // Tabla de configuración del sistema
            `CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )`,
            // Estado inicial del servicio
            `INSERT OR IGNORE INTO system_settings (key, value) VALUES ('service_status', 'available')`
        ]);
        console.log('Conectado a rqlite: Estructura de base de datos sincronizada.');
    } catch (err) {
        console.error('Error al inicializar la base de datos :', err);
    }
};

// Ejecutamos la inicialización al cargar el módulo
initDb();

// Exportamos el cliente para que server.js realice las consultas
module.exports = client;