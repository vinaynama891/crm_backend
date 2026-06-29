import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticateJWT, requireRoles } from '../middlewares/auth';

const router = Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/me', authenticateJWT, authController.me);
router.post('/invite', authenticateJWT, requireRoles(['ADMIN', 'SALES_MANAGER']), authController.inviteUser);
router.get('/team', authenticateJWT, authController.getTeam);

export default router;
