import { Router } from 'express';
import { propertyController } from '../controllers/propertyController';
import { authenticateJWT, requireRoles } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/', propertyController.getProperties);
router.get('/:id', propertyController.getPropertyById);
router.post('/', requireRoles(['ADMIN', 'SALES_MANAGER']), propertyController.createProperty);
router.put('/:id', requireRoles(['ADMIN', 'SALES_MANAGER']), propertyController.updateProperty);
router.delete('/:id', requireRoles(['ADMIN', 'SALES_MANAGER']), propertyController.deleteProperty);

export default router;
