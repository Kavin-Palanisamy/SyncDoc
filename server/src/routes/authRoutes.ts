import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';

const router = Router();

// Authentication endpoints
router.post('/google', AuthController.googleLogin);
router.post('/login', AuthController.login);
router.post('/signup', AuthController.signup);
router.get('/me', AuthController.getMe);
router.post('/logout', AuthController.logout);

export default router;
