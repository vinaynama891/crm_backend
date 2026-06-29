import { Router } from 'express';
import { leadController } from '../controllers/leadController';
import { authenticateJWT, requireRoles } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/', leadController.getLeads);
router.post('/', leadController.createLead);
router.get('/:id', leadController.getLeadById);
router.put('/:id', leadController.updateLead);
router.post('/:id/call', leadController.callLead);
router.post('/:id/share', leadController.shareProperty);
router.post('/:id/notes', leadController.addNote);
router.post('/:id/whatsapp', leadController.sendWhatsApp);
router.post('/:id/assign', requireRoles(['ADMIN', 'SALES_MANAGER']), leadController.assignAgent);

export default router;
