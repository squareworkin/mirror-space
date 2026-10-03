import { getPool } from '../config/postgres.js';

// mood_patterns has no meets_minimum_data column and no nested period subdocument —
// meetsMinimumData is folded into the patterns jsonb on write and pulled back out on
// read, and period_start/period_end are re-nested into {period:{start,end}} on read,
// so callers see the same shape the old Mongoose MoodPattern document had.
function mapRow(row) {
  if (!row) return null;
  const { meetsMinimumData, ...patterns } = row.patterns || {};
  return {
    id: row.id,
    userId: row.userId,
    period: { start: row.periodStart, end: row.periodEnd },
    patterns,
    meetsMinimumData: meetsMinimumData ?? false,
    dataPoints: row.dataPoints,
    aiInsight: row.aiInsight,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

const SELECT_FIELDS = `
  id, user_id AS "userId", period_start AS "periodStart", period_end AS "periodEnd",
  patterns, data_points AS "dataPoints", ai_insight AS "aiInsight",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

export async function createMoodPattern(userId, { periodStart, periodEnd, patterns, meetsMinimumData, dataPoints, aiInsight }) {
  const patternsWithFlag = { ...patterns, meetsMinimumData };
  const { rows } = await getPool().query(
    `INSERT INTO mood_patterns (user_id, period_start, period_end, patterns, data_points, ai_insight)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${SELECT_FIELDS}`,
    [userId, periodStart, periodEnd, JSON.stringify(patternsWithFlag), JSON.stringify(dataPoints), JSON.stringify(aiInsight)]
  );
  return mapRow(rows[0]);
}

export async function findLatestMoodPatterns(userId, limit = 4) {
  const { rows } = await getPool().query(
    `SELECT ${SELECT_FIELDS} FROM mood_patterns
     WHERE user_id = $1
     ORDER BY period_end DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map(mapRow);
}
