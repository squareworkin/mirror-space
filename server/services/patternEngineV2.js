import { findSleepLogsSince } from '../db/sleepLogs.js';
import { findJournalEntriesSince } from '../db/journalEntries.js';
import { countSessionsSince } from '../db/chatSessions.js';
import { mean, stddev, zScore, pearsonCorrelation, clamp } from './stats.js';

const MIN_BASELINE_SAMPLES = 5;
const MIN_CORRELATION_PAIRS = 5;
const SLEEP_DEBT_MINUTES = 420; // 7 hours
const CONFIDENCE_FULL_SAMPLE = 14; // two weeks of a 30-day window feels fully confident

// Buckets by UTC calendar day. There is no User.timezone field today, so a log saved
// near midnight local time may land in the "wrong" UTC bucket — accepted limitation,
// not solved here.
export function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function previousDayKey(key) {
  return dayKey(new Date(Date.parse(`${key}T00:00:00.000Z`) - 86400000));
}

export async function buildSleepSeries(userId, windowDays = 30) {
  const windowStart = new Date(Date.now() - windowDays * 86400000);
  const logs = await findSleepLogsSince(userId, windowStart);

  const byDay = new Map();
  for (const log of logs) {
    const key = dayKey(log.date);
    const existing = byDay.get(key);
    // last-write-wins per day — avoids blending an edited/corrected log with a stale one
    if (!existing || log.createdAt > existing.createdAt) {
      const sleepTime = new Date(log.sleepTime);
      byDay.set(key, {
        day: key,
        duration: log.duration,
        sleepHour: sleepTime.getHours() + sleepTime.getMinutes() / 60,
        logId: log.id,
        createdAt: log.createdAt
      });
    }
  }

  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

export async function buildMoodSeries(userId, windowDays = 30) {
  const windowStart = new Date(Date.now() - windowDays * 86400000);
  const entries = await findJournalEntriesSince(userId, windowStart);

  const byDay = new Map();
  for (const entry of entries) {
    const key = dayKey(entry.createdAt);
    const comparative = entry.sentiment?.comparative || 0;
    const wordCount = entry.patterns?.wordCount || 0;
    const emotionalWords = entry.patterns?.emotionalWords || 0;
    const questionCount = entry.patterns?.questionCount || 0;
    const exclamationCount = entry.patterns?.exclamationCount || 0;

    const existing = byDay.get(key);
    if (!existing) {
      byDay.set(key, {
        day: key,
        comparativeSum: comparative,
        wordCountSum: wordCount,
        entryCount: 1,
        totalEmotionalWords: emotionalWords,
        totalQuestionCount: questionCount,
        totalExclamationCount: exclamationCount,
        entryIds: [entry.id]
      });
    } else {
      existing.comparativeSum += comparative;
      existing.wordCountSum += wordCount;
      existing.entryCount += 1;
      existing.totalEmotionalWords += emotionalWords;
      existing.totalQuestionCount += questionCount;
      existing.totalExclamationCount += exclamationCount;
      existing.entryIds.push(entry.id);
    }
  }

  return [...byDay.values()]
    .map(d => ({
      day: d.day,
      avgComparative: d.comparativeSum / d.entryCount,
      avgWordCount: d.wordCountSum / d.entryCount,
      totalEmotionalWords: d.totalEmotionalWords,
      totalQuestionCount: d.totalQuestionCount,
      totalExclamationCount: d.totalExclamationCount,
      entryIds: d.entryIds
    }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

export function computeBaseline(series, field, minSamples = MIN_BASELINE_SAMPLES) {
  if (!series || series.length < minSamples) {
    return { unavailable: true, reason: 'insufficient_data', n: series?.length || 0 };
  }
  const values = series.map(point => point[field]);
  return { mean: mean(values), stddev: stddev(values), n: values.length };
}

export function computeRecentZScores(series, field, baseline, recentDays = 1) {
  if (baseline.unavailable) return { unavailable: true, reason: baseline.reason };
  return series.slice(-recentDays).map(point => ({
    day: point.day,
    value: point[field],
    z: zScore(point[field], baseline.mean, baseline.stddev)
  }));
}

// Pairs sleep duration on day t with mood on day t+1
export function computeLaggedCorrelation(sleepSeries, moodSeries, minPairs = MIN_CORRELATION_PAIRS) {
  const sleepByDay = new Map(sleepSeries.map(point => [point.day, point]));

  const pairs = [];
  for (const moodPoint of moodSeries) {
    const sleepPoint = sleepByDay.get(previousDayKey(moodPoint.day));
    if (sleepPoint) {
      pairs.push({
        sleepDay: sleepPoint.day,
        moodDay: moodPoint.day,
        sleepValue: sleepPoint.duration,
        moodValue: moodPoint.avgComparative,
        sleepLogId: sleepPoint.logId,
        journalEntryIds: moodPoint.entryIds
      });
    }
  }

  if (pairs.length < minPairs) {
    return { unavailable: true, reason: 'insufficient_pairs', n: pairs.length };
  }

  const result = pearsonCorrelation(pairs.map(p => p.sleepValue), pairs.map(p => p.moodValue));
  if (!result) return { unavailable: true, reason: 'zero_variance', n: pairs.length };

  return { r: result.r, n: result.n, pairs };
}

export function computeEmotionalDrift(moodZScores) {
  if (moodZScores.unavailable || moodZScores.length === 0) return null;
  const recentZ = moodZScores[moodZScores.length - 1].z;
  if (recentZ === null) return null;
  return clamp(Math.round(Math.abs(recentZ) * 25), 0, 100);
}

export function computeBurnoutIndicators(sleepSeries, sleepBaseline, moodZScores) {
  if (sleepBaseline.unavailable) return null;

  const sleepDebtNights = sleepSeries.filter(p => p.duration < SLEEP_DEBT_MINUTES).length;
  const sleepDebtFrequency = sleepDebtNights / sleepSeries.length;

  let sustainedNegativeMoodFactor = 0;
  if (!moodZScores.unavailable && moodZScores.length > 0) {
    const recentZ = moodZScores[moodZScores.length - 1].z;
    if (recentZ !== null && recentZ < 0) {
      sustainedNegativeMoodFactor = clamp(-recentZ / 2, 0, 1);
    }
  }

  return clamp(Math.round(sleepDebtFrequency * 60 + sustainedNegativeMoodFactor * 40), 0, 100);
}

export function computeAnxietyBuildUp(moodSeries, minSamples = MIN_BASELINE_SAMPLES) {
  if (!moodSeries || moodSeries.length < minSamples) return null;

  const ratios = moodSeries.map(p => (p.totalQuestionCount + p.totalExclamationCount) / Math.max(p.avgWordCount, 1));
  const baselineMean = mean(ratios);
  const baselineStddev = stddev(ratios);
  const recentRatio = ratios[ratios.length - 1];
  const ratioZ = zScore(recentRatio, baselineMean, baselineStddev);

  if (ratioZ === null) return null;
  return clamp(Math.round(ratioZ * 50 + 50), 0, 100);
}

function sleepDebtFact(sleepSeries, sleepBaseline) {
  if (sleepBaseline.unavailable) return null;
  const debtNights = sleepSeries.filter(p => p.duration < SLEEP_DEBT_MINUTES);
  if (debtNights.length === 0) return null;

  const usualHours = Math.floor(sleepBaseline.mean / 60);
  const usualMinutes = Math.round(sleepBaseline.mean % 60);

  return {
    claim: `${debtNights.length} night${debtNights.length === 1 ? '' : 's'} under 6h sleep this period (your usual is ${usualHours}h ${usualMinutes}m).`,
    metric: 'sleep_debt_frequency',
    value: debtNights.length,
    confidence: clamp(sleepBaseline.n / CONFIDENCE_FULL_SAMPLE, 0, 1),
    evidence: { sleepLogIds: debtNights.map(p => p.logId), journalEntryIds: [] }
  };
}

function correlationFact(correlation) {
  if (correlation.unavailable || Math.abs(correlation.r) < 0.3) return null;

  const direction = correlation.r < 0 ? 'Shorter' : 'Longer';
  const effect = correlation.r < 0 ? 'lower' : 'higher';

  return {
    claim: `${direction} sleep tends to come before ${effect}-mood days (r=${correlation.r.toFixed(2)} across ${correlation.n} nights).`,
    metric: 'sleep_mood_lag_correlation',
    value: correlation.r,
    confidence: clamp(correlation.n / CONFIDENCE_FULL_SAMPLE, 0, 1),
    evidence: {
      sleepLogIds: correlation.pairs.map(p => p.sleepLogId),
      journalEntryIds: correlation.pairs.flatMap(p => p.journalEntryIds)
    }
  };
}

function moodDeviationFact(moodSeries, moodBaseline, moodZScores) {
  if (moodBaseline.unavailable || moodZScores.unavailable || moodZScores.length === 0) return null;
  const recent = moodZScores[moodZScores.length - 1];
  if (recent.z === null || Math.abs(recent.z) < 1) return null;

  const direction = recent.z < 0 ? 'lower' : 'higher';
  const recentEntry = moodSeries[moodSeries.length - 1];

  return {
    claim: `Today's entries read notably ${direction} than your usual tone.`,
    metric: 'mood_baseline_deviation',
    value: recent.z,
    confidence: clamp(moodBaseline.n / CONFIDENCE_FULL_SAMPLE, 0, 1),
    evidence: { sleepLogIds: [], journalEntryIds: recentEntry?.entryIds || [] }
  };
}

export function buildFacts({ sleepSeries, moodSeries, sleepBaseline, moodBaseline, moodZScores, correlation }) {
  const candidates = [
    correlationFact(correlation),
    sleepDebtFact(sleepSeries, sleepBaseline),
    moodDeviationFact(moodSeries, moodBaseline, moodZScores)
  ].filter(Boolean);

  return candidates.slice(0, 3);
}

export async function computeUserPatterns(userId, windowDays = 30) {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowDays * 86400000);

  const [sleepSeries, moodSeries, chatSessionCount] = await Promise.all([
    buildSleepSeries(userId, windowDays),
    buildMoodSeries(userId, windowDays),
    countSessionsSince(userId, windowStart)
  ]);

  const journalEntryCount = moodSeries.reduce((sum, p) => sum + p.entryIds.length, 0);

  const dataPoints = {
    sleepLogs: sleepSeries.length,
    journalEntries: journalEntryCount,
    chatSessions: chatSessionCount
  };

  const meetsMinimumData = dataPoints.sleepLogs + dataPoints.journalEntries >= MIN_BASELINE_SAMPLES;

  if (!meetsMinimumData) {
    return {
      meetsMinimumData: false,
      dataPoints,
      scores: {
        emotionalDrift: 0,
        burnoutIndicators: 0,
        anxietyBuildUp: 0,
        sleepDebt: 0,
        socialWithdrawal: 0,
        languageComplexity: 0
      },
      facts: [],
      windowStart,
      windowEnd
    };
  }

  const sleepBaseline = computeBaseline(sleepSeries, 'duration');
  const moodBaseline = computeBaseline(moodSeries, 'avgComparative');
  const moodZScores = computeRecentZScores(moodSeries, 'avgComparative', moodBaseline, 1);
  const correlation = computeLaggedCorrelation(sleepSeries, moodSeries);

  const emotionalDrift = computeEmotionalDrift(moodZScores);
  const burnoutIndicators = computeBurnoutIndicators(sleepSeries, sleepBaseline, moodZScores);
  const anxietyBuildUp = computeAnxietyBuildUp(moodSeries);

  // sleepDebt: real signal, populated below. socialWithdrawal/languageComplexity are left at 0 —
  // there is no social-activity signal in this data model, and deriving "language complexity" from
  // avgSentenceLength alone would be fabricating a number, which is exactly what this engine exists
  // to stop doing. Not an oversight.
  const sleepDebt = sleepBaseline.unavailable
    ? 0
    : Math.round((sleepSeries.filter(p => p.duration < SLEEP_DEBT_MINUTES).length / sleepSeries.length) * 100);

  const facts = buildFacts({ sleepSeries, moodSeries, sleepBaseline, moodBaseline, moodZScores, correlation });

  return {
    meetsMinimumData: true,
    dataPoints,
    scores: {
      emotionalDrift: emotionalDrift ?? 0,
      burnoutIndicators: burnoutIndicators ?? 0,
      anxietyBuildUp: anxietyBuildUp ?? 0,
      sleepDebt,
      socialWithdrawal: 0,
      languageComplexity: 0
    },
    facts,
    windowStart,
    windowEnd
  };
}
