import express from 'express';
import { getUserSettings, updateMaxVersions } from '../controllers/settingsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Settings routes
router.get('/', getUserSettings); // Get user settings
router.patch('/max-versions', updateMaxVersions); // Update max versions limit

export default router;
