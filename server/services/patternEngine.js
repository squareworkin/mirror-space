import Sentiment from 'sentiment';
import SleepLog from '../models/SleepLog.js';
import JournalEntry from '../models/JournalEntry.js';
import ChatHistory from '../models/ChatHistory.js';

const sentiment = new Sentiment();

/**
 * Analyze text content for patterns
 * Runs silently — user never sees this directly
 */
export function analyzeText(text) {
  const sentimentResult = sentiment.analyze(text);
  
  // Pattern extraction
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  // Emotional word detection
  const emotionalWords = sentimentResult.positive.length + sentimentResult.negative.length;
  
  // Question detection
  const questionCount = (text.match(/\?/g) || []).length;
  const exclamationCount = (text.match(/!/g) || []).length;

  return {
    sentiment: {
      score: sentimentResult.score,
      comparative: sentimentResult.comparative,
      positiveWords: sentimentResult.positive,
      negativeWords: sentimentResult.negative
    },
    patterns: {
      wordCount: words.length,
      avgSentenceLength: sentences.length > 0 
        ? Math.round(words.length / sentences.length) 
        : words.length,
      emotionalWords,
      questionCount,
      exclamationCount
    }
  };
}

/**
 * Get user context for AI — Layer 2 of the prompt system
 * Gathers recent patterns to inject into AI prompts
 */
export async function getUserContext(userId) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Gather sleep data
  const sleepLogs = await SleepLog.find({
    userId,
    date: { $gte: sevenDaysAgo }
  }).sort({ date: -1 });

  // Gather journal data
  const journals = await JournalEntry.find({
    userId,
    createdAt: { $gte: sevenDaysAgo }
  }).sort({ createdAt: -1 });

  // Gather chat activity
  const chatSessions = await ChatHistory.find({
    userId,
    createdAt: { $gte: sevenDaysAgo }
  });

  // Process sleep trends
  const avgSleep = sleepLogs.length
    ? Math.round(sleepLogs.reduce((s, l) => s + l.duration, 0) / sleepLogs.length)
    : null;
  
  const sleepDebtDays = sleepLogs.filter(l => l.duration < 420).length;

  // Process journal trends
  const avgSentiment = journals.length
    ? journals.reduce((s, j) => s + (j.sentiment?.score || 0), 0) / journals.length
    : null;
  
  const avgWordCount = journals.length
    ? Math.round(journals.reduce((s, j) => s + (j.patterns?.wordCount || 0), 0) / journals.length)
    : null;

  // Sentiment direction (trending up, down, or stable)
  let sentimentTrend = 'stable';
  if (journals.length >= 3) {
    const recentAvg = journals.slice(0, Math.floor(journals.length / 2))
      .reduce((s, j) => s + (j.sentiment?.score || 0), 0) / Math.floor(journals.length / 2);
    const olderAvg = journals.slice(Math.floor(journals.length / 2))
      .reduce((s, j) => s + (j.sentiment?.score || 0), 0) / (journals.length - Math.floor(journals.length / 2));
    
    if (recentAvg - olderAvg > 1) sentimentTrend = 'improving';
    else if (olderAvg - recentAvg > 1) sentimentTrend = 'declining';
  }

  // Time since last journal
  const lastJournalDate = journals[0]?.createdAt;
  const daysSinceJournal = lastJournalDate 
    ? Math.floor((new Date() - new Date(lastJournalDate)) / (1000 * 60 * 60 * 24))
    : null;

  return {
    sleepTrend: avgSleep 
      ? `Average ${Math.round(avgSleep / 60)}h ${avgSleep % 60}m sleep over ${sleepLogs.length} nights. ${sleepDebtDays} nights below 7 hours.`
      : 'No sleep data available yet.',
    journalSentiment: avgSentiment !== null
      ? `Sentiment is ${sentimentTrend} (avg score: ${avgSentiment.toFixed(1)}). Average entry length: ${avgWordCount} words.`
      : 'No journal entries yet.',
    recentPatterns: {
      sleepLogs: sleepLogs.length,
      journalEntries: journals.length,
      chatSessions: chatSessions.length,
      daysSinceJournal,
      sentimentTrend,
      avgSleep,
      avgWordCount
    }
  };
}
