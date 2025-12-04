import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import User from '../models/User.js';
import layerProject from '../models/Project.js';

// @desc    Get user settings
// @route   GET /api/settings
// @access  Private
export const getUserSettings = catchAsync(async (req, res, next) => {
    res.status(200).json({
        success: true,
        data: {
            maxVersions: req.user.settings?.maxVersions || 10
        }
    });
});

// @desc    Update max versions setting
// @route   PATCH /api/settings/max-versions
// @access  Private
export const updateMaxVersions = catchAsync(async (req, res, next) => {
    const { maxVersions } = req.body;

    if (!maxVersions || maxVersions < 1 || maxVersions > 15) {
        return next(new AppError('Max versions must be between 1 and 15', 400));
    }

    // Update user's max versions setting
    req.user.settings = req.user.settings || {};
    req.user.settings.maxVersions = parseInt(maxVersions);
    await req.user.save();

    // Update all user's existing projects and trim versions if needed
    const projects = await layerProject.find({ user: req.user._id });
    
    const updatePromises = projects.map(async (project) => {
        project.maxVersions = parseInt(maxVersions);
        
        // Trim versions array if new limit is smaller
        if (project.versions.length > project.maxVersions) {
            project.versions = project.versions.slice(-project.maxVersions);
        }
        
        return project.save();
    });

    await Promise.all(updatePromises);

    res.status(200).json({
        success: true,
        message: 'Max versions setting updated for all projects',
        data: {
            maxVersions: req.user.settings.maxVersions,
            projectsUpdated: projects.length
        }
    });
});
