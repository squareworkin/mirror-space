import mongoose from 'mongoose';

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  messages: [{
    role: {
      type: String,
      enum: ['user', 'mirror'],
      required: true
    },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  context: {
    sleepTrend: { type: String },
    journalSentiment: { type: String },
    recentPatterns: { type: Object }
  },
  sessionEndedAt: { type: Date, default: null }
}, { timestamps: true });

chatHistorySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('ChatHistory', chatHistorySchema);
