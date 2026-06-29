import { Router } from 'express';
import { settingsController } from '../controllers/settingsController';
import { authenticateJWT, requireRoles } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT);
router.use(requireRoles(['ADMIN']));

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);

export default router;
