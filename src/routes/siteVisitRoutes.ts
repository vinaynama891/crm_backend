import { Router } from 'express';
import { siteVisitController } from '../controllers/siteVisitController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/', siteVisitController.getSiteVisits);
router.post('/', siteVisitController.createSiteVisit);
router.put('/:id/status', siteVisitController.updateStatus);

export default router;
