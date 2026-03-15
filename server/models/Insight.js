import mongoose from 'mongoose';

const insightSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['daily', 'weekly'],
    required: true
  },
  headline: { type: String, required: true },
  subtext: { type: String },
  basedOn: [{ 
    type: String, 
    enum: ['sleep', 'journal', 'activity', 'voice', 'chat'] 
  }],
  date: { type: Date, required: true },
  seen: { type: Boolean, default: false }
}, { timestamps: true });

insightSchema.index({ userId: 1, date: -1, type: 1 });

export default mongoose.model('Insight', insightSchema);
