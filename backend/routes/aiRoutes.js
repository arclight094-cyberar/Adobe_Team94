import express from 'express';
import { 
    relightImage, 
    enhanceImage,
    faceRestore,
    styleTransfer,
    removeBackground,
    objectRemoval,
    separateLayers,
    replaceBackground
} from '../controllers/aiOperationsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);


// AI processing routes
router.post('/separate-layers', separateLayers);
router.post('/relight', relightImage);
router.post('/enhance', enhanceImage);
router.post('/face-restore', faceRestore);
router.post('/style-transfer', styleTransfer);
router.post('/remove-background', removeBackground);
router.post('/object-removal', objectRemoval);
router.post('/replace-background', replaceBackground);

export default router;
