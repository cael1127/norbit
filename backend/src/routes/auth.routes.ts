import { Router } from 'express';
import { authRateLimiter } from '../middleware/rateLimiter';
import { AuthController } from '../controllers/auth.controller';

const router = Router();
const authController = new AuthController();

router.post('/register', authRateLimiter, authController.register.bind(authController));
router.post('/login', authRateLimiter, authController.login.bind(authController));
router.post('/refresh', authController.refreshToken.bind(authController));
router.post('/logout', authController.logout.bind(authController));

export { router as authRoutes };
