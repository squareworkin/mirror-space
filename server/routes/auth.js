import express from 'express';
import { verifySupabaseToken } from '../middleware/supabaseAuth.js';
import { findOrCreateUserForAuthId } from '../db/users.js';

const router = express.Router();

// POST /api/auth/init — Find or create the public.users row for the verified
// Supabase auth session. Called once right after the client signs in anonymously.
router.post('/init', async (req, res) => {
  try {
    const authUserId = await verifySupabaseToken(req);
    const user = await findOrCreateUserForAuthId(authUserId);

    res.status(200).json({
      user: {
        id: user.id,
        onboardingComplete: user.onboardingComplete,
        intents: user.intents,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Auth init error:', error);
    res.status(401).json({ message: 'Could not initialize' });
  }
});

export default router;
