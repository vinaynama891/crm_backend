import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController';
import { authenticateJWT, requireRoles } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/dashboard', analyticsController.getDashboardKPIs);
router.get('/funnel', analyticsController.getFunnel);
router.get('/responsetime', analyticsController.getResponseTime);
router.get('/agents', requireRoles(['ADMIN', 'SALES_MANAGER']), analyticsController.getAgentLeaderboard);
router.get('/export', requireRoles(['ADMIN', 'SALES_MANAGER']), analyticsController.exportReport);

export default router;
