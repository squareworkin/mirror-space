import express from 'express';
import auth from '../middleware/auth.js';
import ChatHistory from '../models/ChatHistory.js';
import { generateChatResponse } from '../services/reflectionEngine.js';
import { getUserContext } from '../services/patternEngine.js';

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
      session = await ChatHistory.findOne({ _id: sessionId, userId: req.userId });
    }

    if (!session) {
      // Get user context for AI
      const context = await getUserContext(req.userId);
      session = await ChatHistory.create({
        userId: req.userId,
        messages: [],
        context
      });
    }

    // Add user message
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    // Generate reflective response
    const response = await generateChatResponse(
      session.messages,
      session.context
    );

    // Add mirror response
    session.messages.push({
      role: 'mirror',
      content: response,
      timestamp: new Date()
    });

    await session.save();

    res.json({
      sessionId: session._id,
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
    const sessions = await ChatHistory.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('messages createdAt');

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch history' });
  }
});

export default router;
