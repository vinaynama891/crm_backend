import { Router } from 'express';
import { followupController } from '../controllers/followupController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/', followupController.getFollowUps);
router.post('/', followupController.createFollowUp);
router.post('/:id/complete', followupController.completeFollowUp);
router.post('/:id/snooze', followupController.snoozeFollowUp);
router.post('/:id/reschedule', followupController.rescheduleFollowUp);

export default router;
