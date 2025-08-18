import { Router } from 'express';
import { analyzePost, getRecommendations } from '../controllers/ai.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/analyze-post', authMiddleware, analyzePost);
router.get('/recommendations/:userId', authMiddleware, getRecommendations);

export { router };
