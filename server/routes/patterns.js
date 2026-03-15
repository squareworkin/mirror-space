import express from 'express';
import auth from '../middleware/auth.js';
import MoodPattern from '../models/MoodPattern.js';

const router = express.Router();

// GET /api/patterns — Get detected patterns
router.get('/', auth, async (req, res) => {
  try {
    const patterns = await MoodPattern.find({ userId: req.userId })
      .sort({ 'period.end': -1 })
      .limit(4);

    res.json(patterns);
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch patterns' });
  }
});

export default router;
