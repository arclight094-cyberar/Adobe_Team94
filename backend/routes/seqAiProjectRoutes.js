import express from 'express';
import {
    createAIProject,
    getUserAIProjects,
    getAIProjectDetails,
    addOperation,
    undoLastOperation,
    revertToOperation,
    updateAIProject,
    deleteAIProject,
    getOperationTimeline
} from '../controllers/seqAiProjectController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Project CRUD
router.post('/create', createAIProject);
router.get('/', getUserAIProjects);
router.get('/:projectId', getAIProjectDetails);
router.patch('/:projectId', updateAIProject);
router.delete('/:projectId', deleteAIProject);

// Operation management
router.post('/:projectId/operations', addOperation);
router.post('/:projectId/undo', undoLastOperation);
router.post('/:projectId/revert/:operationIndex', revertToOperation);
router.get('/:projectId/timeline', getOperationTimeline);

export default router;
