import { getPool } from '../config/postgres.js';

const SELECT_FIELDS = `
  id, user_id AS "userId", context, session_ended_at AS "sessionEndedAt",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

export async function createSession(userId, context) {
  const { rows } = await getPool().query(
    `INSERT INTO chat_sessions (user_id, context)
     VALUES ($1, $2)
     RETURNING ${SELECT_FIELDS}`,
    [userId, JSON.stringify(context)]
  );
  return rows[0];
}

export async function findSessionById(sessionId, userId) {
  const { rows } = await getPool().query(
    `SELECT ${SELECT_FIELDS} FROM chat_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  return rows[0] || null;
}

export async function touchSessionUpdatedAt(sessionId) {
  await getPool().query(`UPDATE chat_sessions SET updated_at = now() WHERE id = $1`, [sessionId]);
}

export async function countSessionsSince(userId, startDate) {
  const { rows } = await getPool().query(
    `SELECT COUNT(*)::int AS count FROM chat_sessions WHERE user_id = $1 AND created_at >= $2`,
    [userId, startDate]
  );
  return rows[0].count;
}
