const { DataApiClient } = require('rqlite-js');

const dbUrl = process.env.DB_URL;
const client = new DataApiClient(dbUrl);

// Función de ayuda para reintentar la conexión (Evita el error 503 al arrancar)
const wait = (ms) => new Promise(res => setTimeout(res, ms));

const initDb = async (retries = 5) => {
    while (retries > 0) {
        try {
            // rqlite-js espera un array de arrays para consultas parametrizadas
            await client.execute([
                [`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    dni TEXT UNIQUE,
                    nombre_completo TEXT,
                    support_number TEXT
                )`],
                [`CREATE TABLE IF NOT EXISTS appointments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT,
                    time TEXT,
                    user_id INTEGER,
                    UNIQUE(date, time),
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )`],
                [`CREATE TABLE IF NOT EXISTS system_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )`],
                [`INSERT OR IGNORE INTO users (id, dni, nombre_completo, support_number) VALUES (0, 'admin', 'Administrador', 'admin')`],
                [`INSERT OR IGNORE INTO system_settings (key, value) VALUES ('service_status', 'available')`]
            ]);
            console.log('Conectado a rqlite: Estructura de base de datos sincronizada.');
            return; // Éxito
        } catch (err) {
            retries--;
            console.error(`Error de conexión (quedan ${retries} intentos):`, err.message);
            if (retries === 0) process.exit(1); // Si falla tras 5 intentos, cerramos el pod
            await wait(5000); // Esperar 5 segundos antes de reintentar
        }
    }
};

initDb();

// Exportamos un objeto que mapea correctamente los parámetros para server.js
module.exports = {
    execute: async (sql, params = []) => {
        const result = await client.execute([[sql, ...params]]);
        return result.get(0);
    },
    query: async (sql, params = []) => {
        const result = await client.query([[sql, ...params]]);
        const data = result.get(0);
        
        if (!data || !data.values) return [];
        
        return data.values.map(row => {
            let obj = {};
            data.columns.forEach((col, i) => { obj[col] = row[i]; });
            return obj;
        });
    }
};