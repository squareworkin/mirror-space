import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// PUT /api/user/onboarding — Save onboarding choices
router.put('/onboarding', auth, async (req, res) => {
  try {
    const { intents, permissions } = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { 
        intents,
        permissions,
        onboardingComplete: true
      },
      { new: true }
    );

    res.json({
      id: user._id,
      intents: user.intents,
      permissions: user.permissions,
      onboardingComplete: user.onboardingComplete
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ message: 'Could not save preferences' });
  }
});

// GET /api/user/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({
      id: user._id,
      intents: user.intents,
      permissions: user.permissions,
      onboardingComplete: user.onboardingComplete,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch profile' });
  }
});

export default router;
