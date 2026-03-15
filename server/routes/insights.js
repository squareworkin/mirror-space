import express from 'express';
import auth from '../middleware/auth.js';
import Insight from '../models/Insight.js';
import { generateDailyInsight, generateWeeklyInsight } from '../services/insightGenerator.js';

const router = express.Router();

// GET /api/insights/today — Get today's insight
router.get('/today', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let insight = await Insight.findOne({
      userId: req.userId,
      type: 'daily',
      date: { $gte: today }
    });

    // Generate if not exists
    if (!insight) {
      insight = await generateDailyInsight(req.userId);
    }

    if (insight) {
      // Mark as seen
      insight.seen = true;
      await insight.save();
    }

    res.json(insight || { headline: 'Be still for a moment.', subtext: 'Not every day needs a reflection.' });
  } catch (error) {
    console.error('Insight error:', error);
    res.status(500).json({ message: 'Could not get insight' });
  }
});

// GET /api/insights/weekly — Get weekly reflection
router.get('/weekly', auth, async (req, res) => {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let insight = await Insight.findOne({
      userId: req.userId,
      type: 'weekly',
      date: { $gte: weekAgo }
    });

    if (!insight) {
      insight = await generateWeeklyInsight(req.userId);
    }

    res.json(insight || { headline: 'A week is just seven attempts at rest.', subtext: null });
  } catch (error) {
    console.error('Weekly insight error:', error);
    res.status(500).json({ message: 'Could not get weekly insight' });
  }
});

export default router;
