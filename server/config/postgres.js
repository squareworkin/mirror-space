import pg from 'pg';

const { Pool } = pg;

// Lazily constructed — dotenv.config() in server.js runs after this module is
// imported, so DATABASE_URL isn't set yet at module-evaluation time.
let pool = null;
export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

export async function connectPostgres() {
  try {
    await getPool().query('SELECT 1');
    console.log('Postgres Connected');
  } catch (error) {
    console.error(`Postgres connection error: ${error.message}`);
    process.exit(1);
  }
}
