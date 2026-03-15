import express from 'express';
import auth from '../middleware/auth.js';
import SleepLog from '../models/SleepLog.js';

const router = express.Router();

// POST /api/sleep — Log sleep entry
router.post('/', auth, async (req, res) => {
  try {
    const { date, sleepTime, wakeTime } = req.body;

    const sleepDate = new Date(sleepTime);
    const wakeDate = new Date(wakeTime);
    const duration = Math.round((wakeDate - sleepDate) / (1000 * 60)); // minutes

    const log = await SleepLog.create({
      userId: req.userId,
      date: new Date(date),
      sleepTime: sleepDate,
      wakeTime: wakeDate,
      duration
    });

    res.status(201).json(log);
  } catch (error) {
    console.error('Sleep log error:', error);
    res.status(500).json({ message: 'Could not log sleep' });
  }
});

// GET /api/sleep/trends — Get sleep trends
router.get('/trends', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await SleepLog.find({
      userId: req.userId,
      date: { $gte: startDate }
    }).sort({ date: -1 });

    // Calculate trends
    const avgDuration = logs.length 
      ? Math.round(logs.reduce((sum, l) => sum + l.duration, 0) / logs.length)
      : 0;

    const sleepDebt = logs.filter(l => l.duration < 420).length; // less than 7 hours

    // Irregularity: standard deviation of sleep times
    let irregularity = 0;
    if (logs.length > 1) {
      const sleepHours = logs.map(l => new Date(l.sleepTime).getHours() + new Date(l.sleepTime).getMinutes() / 60);
      const avgHour = sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length;
      irregularity = Math.sqrt(sleepHours.reduce((sum, h) => sum + Math.pow(h - avgHour, 2), 0) / sleepHours.length);
    }

    res.json({
      logs,
      trends: {
        avgDuration,
        sleepDebt,
        irregularity: Math.round(irregularity * 100) / 100,
        totalLogs: logs.length
      }
    });
  } catch (error) {
    console.error('Sleep trends error:', error);
    res.status(500).json({ message: 'Could not get trends' });
  }
});

export default router;
