import express from 'express';
import auth from '../middleware/supabaseAuth.js';
import { generateChatResponse } from '../services/reflectionEngine.js';
import { getUserContext } from '../services/patternEngine.js';
import { createSession, findSessionById, touchSessionUpdatedAt } from '../db/chatSessions.js';
import { insertMessage, findMessagesForSession, findRecentSessionsWithMessages } from '../db/chatMessages.js';

const router = express.Router();

// POST /api/chat/message — Send message to reflective chatbot
router.post('/message', auth, async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Get or create chat session
    let session;
    if (sessionId) {
      session = await findSessionById(sessionId, req.userId);
    }

    if (!session) {
      // Get user context for AI
      const context = await getUserContext(req.userId);
      session = await createSession(req.userId, context);
    }

    const priorMessages = await findMessagesForSession(session.id);

    // Add user message
    await insertMessage(session.id, { role: 'user', content: message });

    // Generate reflective response — history includes the message just added,
    // matching the original embedded-array behavior where the push happened
    // before the AI call.
    const conversationHistory = [...priorMessages, { role: 'user', content: message }];
    const response = await generateChatResponse(conversationHistory, session.context);

    // Add mirror response
    await insertMessage(session.id, { role: 'mirror', content: response });
    await touchSessionUpdatedAt(session.id);

    res.json({
      sessionId: session.id,
      response,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ message: 'The mirror is resting. Try again in a moment.' });
  }
});

// GET /api/chat/history — Get chat history
router.get('/history', auth, async (req, res) => {
  try {
    const sessions = await findRecentSessionsWithMessages(req.userId, 10);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch history' });
  }
});

export default router;
