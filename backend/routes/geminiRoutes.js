import express from 'express';
import {
    analyzeImage,
    processPrompt
} from '../controllers/seqAiGeminiController.js';
import { autoEnhanceAnalysis, applyEnhancements } from '../controllers/GeminiEnhanceController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Gemini AI analysis routes
router.post('/analyze', analyzeImage);
router.post('/prompt', processPrompt);
router.post('/auto-enhance/:projectId', autoEnhanceAnalysis);
router.post('/apply-enhancements/:projectId', applyEnhancements);

export default router;
