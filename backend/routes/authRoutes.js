import express from 'express';
import { signup, login, verifyOTP, resendOTP , logout} from '../controllers/authController.js';
import { googleAuth } from '../controllers/GauthController.js';

const router = express.Router();

// Auth routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);

// Google OAuth
router.post('/google', googleAuth);

//Logged out route 
router.get('/logout', logout);

export default router;
