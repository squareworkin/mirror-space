import { getPool } from '../config/postgres.js';

export async function insertMessage(sessionId, { role, content }) {
  const { rows } = await getPool().query(
    `INSERT INTO chat_messages (session_id, role, content)
     VALUES ($1, $2, $3)
     RETURNING id, session_id AS "sessionId", role, content, created_at AS "createdAt"`,
    [sessionId, role, content]
  );
  return rows[0];
}

export async function findMessagesForSession(sessionId) {
  const { rows } = await getPool().query(
    `SELECT role, content, created_at AS "createdAt"
     FROM chat_messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId]
  );
  return rows;
}

// One row per session, each with its messages nested — mirrors the shape
// ChatHistory.find().select('messages createdAt') used to return.
export async function findRecentSessionsWithMessages(userId, limit = 10) {
  const { rows } = await getPool().query(
    `SELECT
       s.id,
       s.created_at AS "createdAt",
       COALESCE(
         json_agg(
           json_build_object('role', m.role, 'content', m.content, 'timestamp', m.created_at)
           ORDER BY m.created_at ASC
         ) FILTER (WHERE m.id IS NOT NULL),
         '[]'
       ) AS messages
     FROM chat_sessions s
     LEFT JOIN chat_messages m ON m.session_id = s.id
     WHERE s.user_id = $1
     GROUP BY s.id, s.created_at
     ORDER BY s.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}
