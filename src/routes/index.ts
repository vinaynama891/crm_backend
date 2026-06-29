import { Router } from 'express';
import authRoutes from './authRoutes';
import leadRoutes from './leadRoutes';
import propertyRoutes from './propertyRoutes';
import followupRoutes from './followupRoutes';
import siteVisitRoutes from './siteVisitRoutes';
import analyticsRoutes from './analyticsRoutes';
import settingsRoutes from './settingsRoutes';
import twimlRoutes from './twimlRoutes';
import webhookRoutes from './webhookRoutes';
import notificationRoutes from './notificationRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/leads', leadRoutes);
router.use('/properties', propertyRoutes);
router.use('/followups', followupRoutes);
router.use('/sitevisits', siteVisitRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/settings', settingsRoutes);
router.use('/twiml', twimlRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/notifications', notificationRoutes);

export default router;
