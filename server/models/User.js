import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  localId: {
    type: String,
    required: true,
    unique: true
  },
  intents: [{
    type: String,
    enum: ['understand_mind', 'reduce_anxiety', 'sleep_better', 'vent_without_judgment']
  }],
  permissions: {
    sleepTracking: { type: Boolean, default: false },
    journaling: { type: Boolean, default: false },
    chatReflections: { type: Boolean, default: false }
  },
  onboardingComplete: { type: Boolean, default: false },
  lastActiveAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
