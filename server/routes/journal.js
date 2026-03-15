import express from 'express';
import auth from '../middleware/auth.js';
import JournalEntry from '../models/JournalEntry.js';
import { analyzeText } from '../services/patternEngine.js';

const router = express.Router();

// POST /api/journal — Create journal/vent entry
router.post('/', auth, async (req, res) => {
  try {
    const { content, type = 'text' } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Content is required' });
    }

    // Analyze text patterns (runs silently, user doesn't see this)
    const analysis = analyzeText(content);

    const entry = await JournalEntry.create({
      userId: req.userId,
      type,
      content,
      sentiment: analysis.sentiment,
      patterns: analysis.patterns
    });

    // Return minimal response — no analysis shown to user
    res.status(201).json({
      id: entry._id,
      type: entry.type,
      createdAt: entry.createdAt
    });
  } catch (error) {
    console.error('Journal error:', error);
    res.status(500).json({ message: 'Could not save entry' });
  }
});

// GET /api/journal — Get journal entries
router.get('/', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;

    const entries = await JournalEntry.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('type content reflection createdAt');

    const total = await JournalEntry.countDocuments({ userId: req.userId });

    res.json({ entries, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Journal fetch error:', error);
    res.status(500).json({ message: 'Could not fetch entries' });
  }
});

export default router;
