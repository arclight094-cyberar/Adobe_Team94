import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import seqAIProject from '../models/AIProject.js';


// @desc    Create new AI project (empty, ready for image upload)
// @route   POST /api/v1/adobe-ps/ai-projects/create
// @access  Private
export const createAIProject = catchAsync(async (req, res, next) => {
    const { title, description, canvasWidth, canvasHeight, backgroundColor } = req.body;

    // Create empty AI project (no image yet)
    const project = await seqAIProject.create({
        user: req.user._id,
        title: title || 'AI Edit layerProject',
        description: description || '',
        canvasWidth: canvasWidth || 1920,
        canvasHeight: canvasHeight || 1080,
        backgroundColor: backgroundColor || '#ffffff',
        operations: []
    });

    res.status(201).json({
        success: true,
        message: 'AI project created successfully. Ready for image upload.',
        data: {
            projectId: project._id,
            title: project.title,
            description: project.description,
            canvasWidth: project.canvasWidth,
            canvasHeight: project.canvasHeight,
            backgroundColor: project.backgroundColor,
            createdAt: project.createdAt
        }
    });
});


// @desc    Get all AI projects for user
// @route   GET /api/ai-projects
// @access  Private
export const getUserAIProjects = catchAsync(async (req, res, next) => {
    const { status } = req.query;
    
    const filter = { user: req.user._id };
    if (status) {
        filter.status = status;
    } else {
        filter.status = 'active'; // Default to active projects
    }

    const projects = await seqAIProject.find(filter)
        .sort({ updatedAt: -1 })
        .select('title description thumbnail currentImage operations createdAt updatedAt');

    const projectsData = projects.map(project => ({
        projectId: project._id,
        title: project.title,
        description: project.description,
        thumbnail: project.thumbnail,
        currentImage: {
            imageUrl: project.currentImage.imageUrl,
            publicId: project.currentImage.publicId,
            width: project.currentImage.width,
            height: project.currentImage.height
        },
        totalOperations: project.operations.length,
        lastOperation: project.operations.length > 0 
            ? project.operations[project.operations.length - 1].operationType 
            : null,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
    }));

    res.status(200).json({
        success: true,
        count: projects.length,
        data: projectsData
    });
});




// @desc    Get AI project details with full operation history
// @route   GET /api/ai-projects/:projectId
// @access  Private
export const getAIProjectDetails = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;

    if (!projectId) {
        return next(new AppError('Please provide project ID', 400));
    }

    const project = await seqAIProject.findById(projectId).populate('user', 'name email');

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
            description: project.description,
            user: project.user,
            originalImage: project.originalImage,
            currentImage: project.currentImage,
            operations: project.operations,
            totalOperations: project.operations.length,
            thumbnail: project.thumbnail,
            status: project.status,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
        }
    });
});




// @desc    Add AI operation to project
// @route   POST /api/ai-projects/:projectId/operations
// @access  Private
export const addOperation = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;
    const { operationType, prompt, outputImage, inputImage } = req.body;

    if (!projectId) {
        return next(new AppError('Please provide project ID', 400));
    }

    if (!operationType) {
        return next(new AppError('Operation type is required', 400));
    }

    if (!outputImage) {
        return next(new AppError('Output image is required', 400));
    }

    const project = await seqAIProject.findById(projectId);

    if (!project) {
        return next(new AppError('layerProject not found', 404));
    }

    if (project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized to modify this project', 403));
    }

    // Add operation to project
    await project.addOperation({
        operationType,
        prompt: prompt || {},
        inputImage: inputImage || project.currentImage,
        outputImage
    });

    res.status(200).json({
        success: true,
        message: 'Operation added successfully',
        data: {
            projectId: project._id,
            currentImage: project.currentImage,
            totalOperations: project.operations.length,
            latestOperation: project.operations[project.operations.length - 1]
        }
    });
});





// @desc    Undo last operation
// @route   POST /api/ai-projects/:projectId/undo
// @access  Private
export const undoLastOperation = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;

    if (!projectId) {
        return next(new AppError('Please provide project ID', 400));
    }

    const project = await seqAIProject.findById(projectId);

    if (!project) {
        return next(new AppError('layerProject not found', 404));
    }

    if (project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized to modify this project', 403));
    }

    if (project.operations.length === 0) {
        return next(new AppError('No operations to undo', 400));
    }

    await project.undoLastOperation();

    res.status(200).json({
        success: true,
        message: 'Last operation undone successfully',
        data: {
            projectId: project._id,
            currentImage: project.currentImage,
            totalOperations: project.operations.length
        }
    });
});




// @desc    Revert to specific operation
// @route   POST /api/ai-projects/:projectId/revert/:operationIndex
// @access  Private
export const revertToOperation = catchAsync(async (req, res, next) => {
    const { projectId, operationIndex } = req.params;

    if (!projectId) {
        return next(new AppError('Please provide project ID', 400));
    }

    const index = parseInt(operationIndex);
    if (isNaN(index)) {
        return next(new AppError('Invalid operation index', 400));
    }

    const project = await seqAIProject.findById(projectId);

    if (!project) {
        return next(new AppError('layerProject not found', 404));
    }

    if (project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized to modify this project', 403));
    }

    // -1 means revert to original
    if (index < -1 || index >= project.operations.length) {
        return next(new AppError('Invalid operation index', 400));
    }

    await project.revertToOperation(index);

    res.status(200).json({
        success: true,
        message: index === -1 
            ? 'Reverted to original image' 
            : `Reverted to operation ${index + 1}`,
        data: {
            projectId: project._id,
            currentImage: project.currentImage,
            totalOperations: project.operations.length
        }
    });
});




// @desc    Update AI project title/description
// @route   PATCH /api/ai-projects/:projectId
// @access  Private
export const updateAIProject = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;
    const { title, description, status } = req.body;

    if (!projectId) {
        return next(new AppError('Please provide project ID', 400));
    }

    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (status !== undefined) updateFields.status = status;

    const project = await seqAIProject.findOneAndUpdate(
        { _id: projectId, user: req.user._id },
        updateFields,
        { new: true, runValidators: true }
    );

    if (!project) {
        return next(new AppError('layerProject not found or not authorized', 404));
    }

    res.status(200).json({
        success: true,
        message: 'layerProject updated successfully',
        data: {
            projectId: project._id,
            title: project.title,
            description: project.description,
            status: project.status
        }
    });
});




// @desc    Delete AI project
// @route   DELETE /api/ai-projects/:projectId
// @access  Private
export const deleteAIProject = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;
    const { permanent } = req.query;

    if (!projectId) {
        return next(new AppError('Please provide project ID', 400));
    }

    const project = await seqAIProject.findOne({ _id: projectId, user: req.user._id });

    if (!project) {
        return next(new AppError('layerProject not found or not authorized', 404));
    }

    if (permanent === 'true') {
        // Permanently delete
        await seqAIProject.findByIdAndDelete(projectId);
        // TODO: Delete all images from Cloudinary
        message = 'layerProject permanently deleted';
    } else {
        // Soft delete - just mark as deleted
        project.status = 'deleted';
        await project.save();
        var message = 'layerProject moved to trash';
    }

    res.status(200).json({
        success: true,
        message: message
    });
});




// @desc    Get operation history timeline
// @route   GET /api/ai-projects/:projectId/timeline
// @access  Private
export const getOperationTimeline = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;

    if (!projectId) {
        return next(new AppError('Please provide project ID', 400));
    }

    const project = await seqAIProject.findOne({ _id: projectId, user: req.user._id })
        .select('title originalImage operations');

    if (!project) {
        return next(new AppError('layerProject not found or not authorized', 404));
    }

    // Build timeline with original image as first entry
    const timeline = [
        {
            index: -1,
            operationType: 'original',
            image: project.originalImage,
            timestamp: project.createdAt,
            prompt: null
        },
        ...project.operations.map((op, index) => ({
            index: index,
            operationType: op.operationType,
            image: op.outputImage,
            inputImage: op.inputImage, // Include input image (base image for style transfer)
            timestamp: op.timestamp,
            prompt: op.prompt,
            processingTime: op.processingTime,
            status: op.status
        }))
    ];

    res.status(200).json({
        success: true,
        data: {
            projectId: project._id,
            title: project.title,
            timeline: timeline,
            totalSteps: timeline.length
        }
    });
});
