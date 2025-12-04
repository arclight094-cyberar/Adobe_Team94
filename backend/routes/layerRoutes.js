import express from 'express';
import {
    createLayer,
    getProjectLayers,
    getLayer,
    updateLayer,
    reorderLayers,
    deleteLayer,
    duplicateLayer
} from '../controllers/layerController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Layer CRUD operations
router.post('/', createLayer);
router.get('/project/:projectId', getProjectLayers);
router.get('/:layerId', getLayer);
router.patch('/:layerId', updateLayer);
router.delete('/:layerId', deleteLayer);

// Layer-specific operations
router.patch('/project/:projectId/reorder', reorderLayers);
router.post('/:layerId/duplicate', duplicateLayer);

export default router;
