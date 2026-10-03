import { getPool } from '../config/postgres.js';

const SELECT_FIELDS = `
  id, user_id AS "userId", type, headline, subtext,
  based_on AS "basedOn", date, seen,
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

export async function findInsight(userId, type, sinceDate) {
  const { rows } = await getPool().query(
    `SELECT ${SELECT_FIELDS} FROM insights
     WHERE user_id = $1 AND type = $2 AND date >= $3
     ORDER BY date DESC
     LIMIT 1`,
    [userId, type, sinceDate]
  );
  return rows[0] || null;
}

export async function createInsight(userId, { type, headline, subtext, basedOn, date }) {
  const { rows } = await getPool().query(
    `INSERT INTO insights (user_id, type, headline, subtext, based_on, date, seen)
     VALUES ($1, $2, $3, $4, $5, $6, false)
     RETURNING ${SELECT_FIELDS}`,
    [userId, type, headline, subtext, basedOn, date]
  );
  return rows[0];
}

export async function markSeen(insightId) {
  await getPool().query(`UPDATE insights SET seen = true WHERE id = $1`, [insightId]);
}
