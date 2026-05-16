import { Router } from 'express';
import controller from '../controllers/providerController';

const router = Router();

router.get('/', controller.getAllProviders);
router.get('/:id', controller.getProviderById);
router.patch('/:id/verify', controller.verifyProvider);
router.patch('/:id/suspend', controller.suspendProvider);

export default router;
