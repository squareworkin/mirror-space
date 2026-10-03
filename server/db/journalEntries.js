import { getPool } from '../config/postgres.js';

const FULL_FIELDS = `
  id, user_id AS "userId", type, content, sentiment, patterns,
  reflection, reflection_generated_at AS "reflectionGeneratedAt",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

export async function createJournalEntry(userId, { type, content, sentiment, patterns }) {
  const { rows } = await getPool().query(
    `INSERT INTO journal_entries (user_id, type, content, sentiment, patterns)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${FULL_FIELDS}`,
    [userId, type, content, JSON.stringify(sentiment), JSON.stringify(patterns)]
  );
  return rows[0];
}

export async function findJournalEntriesPaginated(userId, { limit, page }) {
  const offset = (page - 1) * limit;
  const { rows } = await getPool().query(
    `SELECT id, type, content, reflection, created_at AS "createdAt"
     FROM journal_entries
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

export async function countJournalEntries(userId) {
  const { rows } = await getPool().query(
    `SELECT COUNT(*)::int AS count FROM journal_entries WHERE user_id = $1`,
    [userId]
  );
  return rows[0].count;
}

export async function findJournalEntriesSince(userId, startDate) {
  const { rows } = await getPool().query(
    `SELECT ${FULL_FIELDS} FROM journal_entries
     WHERE user_id = $1 AND created_at >= $2
     ORDER BY created_at DESC`,
    [userId, startDate]
  );
  return rows;
}
