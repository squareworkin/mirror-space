import { getPool } from '../config/postgres.js';

const SELECT_FIELDS = `
  id, user_id AS "userId", date, sleep_time AS "sleepTime",
  wake_time AS "wakeTime", duration, created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export async function createSleepLog(userId, { date, sleepTime, wakeTime, duration }) {
  const { rows } = await getPool().query(
    `INSERT INTO sleep_logs (user_id, date, sleep_time, wake_time, duration)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_FIELDS}`,
    [userId, date, sleepTime, wakeTime, duration]
  );
  return rows[0];
}

export async function findSleepLogsSince(userId, startDate) {
  const { rows } = await getPool().query(
    `SELECT ${SELECT_FIELDS} FROM sleep_logs
     WHERE user_id = $1 AND date >= $2
     ORDER BY date DESC`,
    [userId, startDate]
  );
  return rows;
}
