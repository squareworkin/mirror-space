import mongoose from 'mongoose';

const sleepLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: { type: Date, required: true },
  sleepTime: { type: Date, required: true },
  wakeTime: { type: Date, required: true },
  duration: { type: Number, required: true }, // minutes
  createdAt: { type: Date, default: Date.now }
});

sleepLogSchema.index({ userId: 1, date: -1 });

export default mongoose.model('SleepLog', sleepLogSchema);
