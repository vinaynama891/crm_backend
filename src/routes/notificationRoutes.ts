import { Router } from 'express';
import { notificationController } from '../controllers/notificationController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/', notificationController.getNotifications);
router.put('/read-all', notificationController.markReadAll);
router.put('/:id/read', notificationController.markRead);

export default router;
