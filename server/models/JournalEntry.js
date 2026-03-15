import mongoose from 'mongoose';

const journalEntrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'chaos'],
    default: 'text'
  },
  content: { type: String, required: true },
  sentiment: {
    score: { type: Number, default: 0 },
    comparative: { type: Number, default: 0 },
    positiveWords: [String],
    negativeWords: [String]
  },
  patterns: {
    wordCount: { type: Number, default: 0 },
    avgSentenceLength: { type: Number, default: 0 },
    emotionalWords: { type: Number, default: 0 },
    questionCount: { type: Number, default: 0 },
    exclamationCount: { type: Number, default: 0 }
  },
  reflection: { type: String, default: null },
  reflectionGeneratedAt: { type: Date, default: null }
}, { timestamps: true });

journalEntrySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('JournalEntry', journalEntrySchema);
