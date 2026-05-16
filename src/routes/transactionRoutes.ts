import { Router } from 'express';
import controller from '../controllers/transactionController';

const router = Router();

router.get('/', controller.getTransactions);
router.get('/stats', controller.getStats);

export default router;
