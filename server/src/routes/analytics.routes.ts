import { Router } from 'express';
import { getMetrics, getPostAnalytics } from '../controllers/analytics.controller';

const router = Router();

router.get('/metrics/:userId', getMetrics);
router.get('/posts/:userId', getPostAnalytics);

export { router };
