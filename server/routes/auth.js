import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';

const router = express.Router();

// POST /api/auth/init — Initialize anonymous user (local-first)
router.post('/init', async (req, res) => {
  try {
    const { localId } = req.body;
    const id = localId || uuidv4();

    // Find or create user atomically
    const user = await User.findOneAndUpdate(
      { localId: id },
      { $setOnInsert: { localId: id } },
      { upsert: true, new: true }
    );

    const token = jwt.sign(
      { userId: user._id, localId: user.localId },
      process.env.JWT_SECRET,
      { expiresIn: '365d' }
    );

    res.status(200).json({
      token,
      user: {
        id: user._id,
        localId: user.localId,
        onboardingComplete: user.onboardingComplete,
        intents: user.intents,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Auth init error:', error);
    res.status(500).json({ message: 'Could not initialize' });
  }
});

export default router;
