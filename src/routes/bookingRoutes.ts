import { Router } from 'express';
import controller from '../controllers/bookingController';

const router = Router();

router.get('/', controller.getBookings);

export default router;
