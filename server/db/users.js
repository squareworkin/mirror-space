import { getPool } from '../config/postgres.js';

const SELECT_FIELDS = `
  id, local_id AS "localId", auth_user_id AS "authUserId",
  intents, permissions, onboarding_complete AS "onboardingComplete",
  last_active_at AS "lastActiveAt", created_at AS "createdAt",
  updated_at AS "updatedAt", email, is_anonymous AS "isAnonymous"
`;

export async function findUserByAuthId(authUserId) {
  const { rows } = await getPool().query(
    `SELECT ${SELECT_FIELDS} FROM users WHERE auth_user_id = $1`,
    [authUserId]
  );
  return rows[0] || null;
}

export async function findOrCreateUserForAuthId(authUserId) {
  const { rows } = await getPool().query(
    `INSERT INTO users (auth_user_id)
     VALUES ($1)
     ON CONFLICT (auth_user_id) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id
     RETURNING ${SELECT_FIELDS}`,
    [authUserId]
  );
  return rows[0];
}

export async function updateOnboarding(userId, { intents, permissions }) {
  const { rows } = await getPool().query(
    `UPDATE users
     SET intents = $2, permissions = $3, onboarding_complete = true
     WHERE id = $1
     RETURNING ${SELECT_FIELDS}`,
    [userId, intents, JSON.stringify(permissions)]
  );
  return rows[0] || null;
}

export async function touchLastActive(userId) {
  await getPool().query(`UPDATE users SET last_active_at = now() WHERE id = $1`, [userId]);
}

export async function getUserProfile(userId) {
  const { rows } = await getPool().query(
    `SELECT ${SELECT_FIELDS} FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}
