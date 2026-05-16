import { Router } from 'express';
import controller from '../controllers/adminController';
import adminAuth from '../middleware/adminAuth';

const router = Router();

router.use(adminAuth);

router.get('/summary', controller.getSummary);
router.get('/providers', controller.getProviders);
router.patch('/providers/:id/verify', controller.verifyProvider);
router.patch('/providers/:id/suspend', controller.suspendProvider);
router.get('/customers', controller.getCustomers);
router.get('/bookings', controller.getBookings);
router.get('/transactions', controller.getTransactions);
router.post('/transactions/:ref/requery', controller.requeryTransaction);

export default router;