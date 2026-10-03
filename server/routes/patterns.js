import express from 'express';
import auth from '../middleware/supabaseAuth.js';
import { createMoodPattern, findLatestMoodPatterns } from '../db/moodPatterns.js';
import { computeUserPatterns } from '../services/patternEngineV2.js';
import { generateAIResponse } from '../services/insightGenerator.js';
import { PERSONALITY_PROMPT } from '../prompts/personality.js';

const router = express.Router();

// GET /api/patterns — Get detected patterns
router.get('/', auth, async (req, res) => {
  try {
    const patterns = await findLatestMoodPatterns(req.userId, 4);
    res.json(patterns);
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch patterns' });
  }
});

// POST /api/patterns/predict — Compute real patterns, let the LLM phrase them
router.post('/predict', auth, async (req, res) => {
  try {
    const computed = await computeUserPatterns(req.userId, 30);

    if (!computed.meetsMinimumData) {
      // Not enough signal to compute anything real — skip the LLM call entirely
      // (cost guardrail) and show the same day-1 copy as before.
      const pattern = await createMoodPattern(req.userId, {
        periodStart: computed.windowStart,
        periodEnd: computed.windowEnd,
        patterns: { ...computed.scores, facts: [] },
        meetsMinimumData: false,
        dataPoints: computed.dataPoints,
        aiInsight: {
          headline: "The system is quiet.",
          summary: "We don't have enough data yet, but what we see is calm."
        }
      });
      return res.json(pattern);
    }

    const systemPrompt = `${PERSONALITY_PROMPT}\n\nYou are the Prediction Engine of MirrorSpace. You will be given ALREADY-COMPUTED facts and scores. Do not invent, adjust, or restate any numbers differently than given. Your only job is to phrase a short headline and a 1-2 sentence summary in MirrorSpace's observational voice, grounded strictly in the facts provided.
Return ONLY a valid JSON object with this schema:
{
  "headline": "<1 short poetic sentence, no numbers>",
  "summary": "<1-2 sentences, may reference the facts in plain language but must not state any number not already given to you>"
}`;

    const factLines = computed.facts.length
      ? computed.facts.map(f => `- ${f.claim}`).join('\n')
      : '- no strong facts this period';

    const userPrompt = `Computed facts (do not alter any numbers):\n${factLines}\n\nComputed scores: burnout=${computed.scores.burnoutIndicators}, anxiety=${computed.scores.anxietyBuildUp}, emotionalDrift=${computed.scores.emotionalDrift}.`;

    const response = await generateAIResponse(systemPrompt, userPrompt);
    let aiInsight = {
      headline: "The tides are shifting quietly.",
      summary: "Patterns are forming, though nothing urgent stands out."
    };

    if (response) {
      try {
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        // Only ever read headline/summary — any numeric field the LLM hallucinates
        // into its JSON is structurally ignored, which is what actually enforces
        // "the LLM only writes the words".
        if (parsed.headline) aiInsight.headline = parsed.headline;
        if (parsed.summary) aiInsight.summary = parsed.summary;
      } catch (e) {
        console.error('Failed to parse prediction phrasing json:', e);
      }
    }

    const pattern = await createMoodPattern(req.userId, {
      periodStart: computed.windowStart,
      periodEnd: computed.windowEnd,
      patterns: { ...computed.scores, facts: computed.facts },
      meetsMinimumData: true,
      dataPoints: computed.dataPoints,
      aiInsight
    });

    res.json(pattern);
  } catch (error) {
    console.error('Prediction generation error:', error);
    res.status(500).json({ message: 'Could not generate prediction' });
  }
});

export default router;
