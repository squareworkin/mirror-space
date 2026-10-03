import express from 'express';
import auth from '../middleware/supabaseAuth.js';
import { insertCalmTrigger } from '../db/calmTriggers.js';

const router = express.Router();

// POST /api/calm/trigger — Log calm mode trigger
router.post('/trigger', auth, async (req, res) => {
  try {
    const { source = 'manual' } = req.body; // 'manual', 'panic_detected', 'behavior_spike'

    // Log the trigger for pattern analysis
    await insertCalmTrigger(req.userId, source);

    res.json({
      activated: true,
      message: 'Breathe.',
      source
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not activate calm mode' });
  }
});

export default router;
