import express from 'express';
import { uploadImage, uploadMultipleImages, deleteImage , getImageDetails, cropImage } from '../controllers/imageController.js';
import upload from '../middleware/upload.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Image routes
router.post('/upload', upload.single('image'), uploadImage);
router.post('/upload-multiple', upload.array('images', 2), uploadMultipleImages); // Max 2 images
router.patch('/crop', cropImage); // Crop image and replace original
router.delete('/:publicId', deleteImage);
router.get('/:publicId', getImageDetails);

export default router;
