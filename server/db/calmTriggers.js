import { getPool } from '../config/postgres.js';

export async function insertCalmTrigger(userId, source) {
  const { rows } = await getPool().query(
    `INSERT INTO calm_triggers (user_id, source)
     VALUES ($1, $2)
     RETURNING id, user_id AS "userId", source, created_at AS "createdAt"`,
    [userId, source]
  );
  return rows[0];
}
