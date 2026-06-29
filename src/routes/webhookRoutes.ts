import { Router } from 'express';
import { webhookController } from '../controllers/webhookController';

const router = Router();

// Public webhook to capture leads from Facebook, Zapier, MagicBricks, etc.
router.post('/leads', webhookController.captureLead);

export default router;
