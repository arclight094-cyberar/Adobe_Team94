import express from 'express';
import {
    createProject,
    getUserProjects,
    getProjectDetails,
    updateProjectTitle,
    deleteProject
} from '../controllers/layerProjectController.js';
import upload from '../middleware/upload.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Project routes (Layer-based editing)
router.post('/create', createProject); // Create new empty project
router.get('/', getUserProjects); // Get all user projects
router.get('/:projectId', getProjectDetails); // Get specific project with all layers
router.patch('/:projectId/title', updateProjectTitle); // Update project title
router.delete('/:projectId', deleteProject); // Delete project

export default router;
