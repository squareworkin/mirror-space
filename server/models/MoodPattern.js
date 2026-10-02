import mongoose from 'mongoose';

const moodPatternSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  period: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  patterns: {
    emotionalDrift: { type: Number, default: 0 },
    burnoutIndicators: { type: Number, default: 0 },
    anxietyBuildUp: { type: Number, default: 0 },
    sleepDebt: { type: Number, default: 0 },
    // socialWithdrawal/languageComplexity stay at default 0 — no social-activity signal exists in
    // this data model, and deriving "language complexity" from avgSentenceLength alone would be
    // fabricating a number. Deliberately dead until a real signal exists, not an oversight.
    socialWithdrawal: { type: Number, default: 0 },
    languageComplexity: { type: Number, default: 0 },
    facts: [{
      claim: { type: String, required: true },
      metric: { type: String, required: true },
      value: { type: Number },
      confidence: { type: Number, min: 0, max: 1 },
      evidence: {
        sleepLogIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SleepLog' }],
        journalEntryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' }]
      }
    }]
  },
  meetsMinimumData: { type: Boolean, default: false },
  dataPoints: {
    sleepLogs: { type: Number, default: 0 },
    journalEntries: { type: Number, default: 0 },
    chatSessions: { type: Number, default: 0 }
  },
  aiInsight: {
    headline: { type: String },
    summary: { type: String }
  }
}, { timestamps: true });

moodPatternSchema.index({ userId: 1, 'period.end': -1 });

export default mongoose.model('MoodPattern', moodPatternSchema);
