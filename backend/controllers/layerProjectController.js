import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import layerProject from '../models/Project.js';

// @desc    Create new empty layer-based project (no image yet)
// @route   POST /api/v1/adobe-ps/projects/create
// @access  Private
export const createProject = catchAsync(async (req, res, next) => {
    const { title, canvasWidth, canvasHeight, backgroundColor } = req.body;

    // Default canvas dimensions if not provided
    const width = canvasWidth || 1920;
    const height = canvasHeight || 1080;

    // Create empty project with canvas
    const project = await layerProject.create({
        user: req.user._id,
        title: title || 'Untitled layerProject',
        canvas: {
            width: width,
            height: height,
            backgroundColor: backgroundColor || '#ffffff'
        },
        layers: [],
        thumbnail: null,
        originalImage: null
    });

    res.status(201).json({
        success: true,
        message: 'Layer-based project created successfully. Ready for image upload.',
        data: {
            projectId: project._id,
            title: project.title,
            canvas: project.canvas,
            layers: [],
            createdAt: project.createdAt
        }
    });
});




// @desc    Get all projects for user
// @route   GET /api/projects
// @access  Private
export const getUserProjects = catchAsync(async (req, res, next) => {
    const projects = await layerProject.find({ user: req.user._id })
        .sort({ updatedAt: -1 })
        .select('title thumbnail canvas layers createdAt updatedAt')
        .populate('layers');

    // Format projects with layer information
    const projectsWithInfo = projects.map(project => ({
        projectId: project._id,
        title: project.title,
        thumbnail: project.thumbnail,
        canvas: project.canvas,
        totalLayers: project.layers.length,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
    }));

    res.status(200).json({
        success: true,
        count: projects.length,
        data: projectsWithInfo
    });
});




// @desc    Get project details with all layers
// @route   GET /api/v1/adobe-ps/projects/:projectId
// @access  Private
export const getProjectDetails = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;

    if (!projectId) {
        return next(new AppError('Please provide project ID', 400));
    }

    const project = await layerProject.findById(projectId)
        .populate('user', 'name email')
        .populate({
            path: 'layers',
            options: { sort: { order: 1 } }
        });

    if (!project) {
        return next(new AppError('layerProject not found', 404));
    }

    if (project.user._id.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized to access this project', 403));
    }

    res.status(200).json({
        success: true,
        data: {
            projectId: project._id,
            title: project.title,
            user: project.user,
            originalImage: project.originalImage,
            canvas: project.canvas,
            layers: project.layers,
            totalLayers: project.layers.length,
            thumbnail: project.thumbnail,
            history: project.history.slice(-10),
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
        }
    });
});




// @desc    Update project title
// @route   PATCH /api/v1/adobe-ps/projects/:projectId/title
// @access  Private
export const updateProjectTitle = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;
    const { title } = req.body;

    if (!projectId) {
        return next(new AppError('Please provide project ID', 400));
    }

    if (!title) {
        return next(new AppError('Please provide a title', 400));
    }

    const project = await layerProject.findOneAndUpdate(
        { _id: projectId, user: req.user._id },
        { title: title },
        { new: true, runValidators: true }
    );

    if (!project) {
        return next(new AppError('layerProject not found or not authorized', 404));
    }

    res.status(200).json({
        success: true,
        message: 'layerProject title updated',
        data: {
            projectId: project._id,
            title: project.title
        }
    });
});




// @desc    Delete project
// @route   DELETE /api/v1/adobe-ps/projects/:projectId
// @access  Private
export const deleteProject = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;

    if (!projectId) {
        return next(new AppError('Please provide project ID', 400));
    }

    const project = await layerProject.findOne({ _id: projectId, user: req.user._id });

    if (!project) {
        return next(new AppError('layerProject not found or not authorized', 404));
    }

    // TODO: Delete all associated layers and their images from Cloudinary
    // const layers = await Layer.find({ project: projectId });
    // await Promise.all(layers.map(layer => cloudinary.uploader.destroy(layer.publicId)));
    // await Layer.deleteMany({ project: projectId });

    await layerProject.findByIdAndDelete(projectId);

    res.status(200).json({
        success: true,
        message: 'layerProject deleted successfully'
    });
});
