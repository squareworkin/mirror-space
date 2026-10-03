import express from 'express';
import auth from '../middleware/supabaseAuth.js';
import { updateOnboarding, getUserProfile } from '../db/users.js';

const router = express.Router();

// PUT /api/user/onboarding — Save onboarding choices
router.put('/onboarding', auth, async (req, res) => {
  try {
    const { intents, permissions } = req.body;

    const user = await updateOnboarding(req.userId, { intents, permissions });

    res.json({
      id: user.id,
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
    const user = await getUserProfile(req.userId);
    res.json({
      id: user.id,
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
