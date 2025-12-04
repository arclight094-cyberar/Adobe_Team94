import Layer from '../models/Layer.js';
import layerProject from '../models/Project.js';
import { cloudinary } from '../config/cloudinary.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';


// @desc    Create a new layer
// @route   POST /api/layers
// @access  Private
export const createLayer = catchAsync(async (req, res, next) => {
    const { 
        projectId, 
        name, 
        type, 
        imageUrl, 
        publicId, 
        maskUrl,
        maskPublicId,
        dimensions,
        order,
        visible,
        opacity,
        blendMode,
        position,
        transformations,
        metadata
    } = req.body; 

    // Validation
    if (!projectId || !type || !imageUrl || !publicId || !dimensions) {
        return next(new AppError('Please provide projectId, type, imageUrl, publicId, and dimensions', 400));
    }

    // Find project and verify ownership
    const project = await layerProject.findById(projectId);
    if (!project) {
        return next(new AppError('layerProject not found', 404));
    }

    if (project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized to add layers to this project', 403));
    }

    // Get the highest order number for new layer positioning
    const highestOrderLayer = await Layer.findOne({ project: projectId })
        .sort({ order: -1 })
        .select('order');
    
    const newOrder = order !== undefined ? order : (highestOrderLayer ? highestOrderLayer.order + 1 : 0);

    // Create the layer
    const newLayer = await Layer.create({
        project: projectId,
        name: name || 'Layer',
        type,
        imageUrl,
        publicId,
        maskUrl: maskUrl || null,
        maskPublicId: maskPublicId || null,
        order: newOrder,
        visible: visible !== undefined ? visible : true,
        opacity: opacity || 100,
        blendMode: blendMode || 'normal',
        position: position || { x: 0, y: 0 },
        dimensions,
        transformations: transformations || {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            flipX: false,
            flipY: false
        },
        metadata: metadata || {}
    });

    // Add layer reference to project
    project.layers.push(newLayer._id);
    await project.save();

    // Add to project history
    await project.addHistory({
        action: 'layer_created',
        layerId: newLayer._id,
        description: `Created layer: ${newLayer.name}`
    });

    res.status(201).json({
        success: true,
        message: 'Layer created successfully',
        data: {
            layer: newLayer
        }
    });
});


// @desc    Get all layers for a project
// @route   GET /api/layers/project/:projectId
// @access  Private
export const getProjectLayers = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;

    const project = await layerProject.findById(projectId).populate({
        path: 'layers',
        options: { sort: { order: 1 } }
    });

    if (!project) {
        return next(new AppError('layerProject not found', 404));
    }

    if (project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized to access this project', 403));
    }

    res.status(200).json({
        success: true,
        data: {
            projectId: project._id,
            layers: project.layers
        }
    });
});


// @desc    Get single layer by ID
// @route   GET /api/layers/:layerId
// @access  Private
export const getLayer = catchAsync(async (req, res, next) => {
    const { layerId } = req.params;

    const layer = await Layer.findById(layerId).populate('project');

    if (!layer) {
        return next(new AppError('Layer not found', 404));
    }

    if (layer.project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized to access this layer', 403));
    }

    res.status(200).json({
        success: true,
        data: {
            layer
        }
    });
});


// @desc    Update layer properties
// @route   PATCH /api/layers/:layerId
// @access  Private
export const updateLayer = catchAsync(async (req, res, next) => {
    const { layerId } = req.params;
    const updates = req.body;

    const layer = await Layer.findById(layerId).populate('project');

    if (!layer) {
        return next(new AppError('Layer not found', 404));
    }

    if (layer.project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized to update this layer', 403));
    }

    // Update allowed fields
    const allowedUpdates = ['name', 'visible', 'locked', 'opacity', 'blendMode', 'position', 'transformations', 'order'];
    Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
            if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
                layer[key] = { ...layer[key], ...updates[key] };
            } else {
                layer[key] = updates[key];
            }
        }
    });

    await layer.save();

    // Add to project history
    await layerProject.findByIdAndUpdate(layer.project._id, {
        $push: {
            history: {
                action: 'layer_updated',
                layerId: layer._id,
                description: `Updated layer: ${layer.name}`,
                timestamp: Date.now()
            }
        }
    });

    res.status(200).json({
        success: true,
        message: 'Layer updated successfully',
        data: { layer }
    });
});


// @desc    Reorder layers
// @route   PATCH /api/layers/project/:projectId/reorder
// @access  Private
export const reorderLayers = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;
    const { layerIds } = req.body;

    if (!Array.isArray(layerIds) || layerIds.length === 0) {
        return next(new AppError('layerIds must be a non-empty array', 400));
    }

    const project = await layerProject.findById(projectId);
    if (!project) {
        return next(new AppError('layerProject not found', 404));
    }

    // Verify ownership
    if (project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized', 403));
    }

    // Verify all layerIds belong to this project
    const layers = await Layer.find({ _id: { $in: layerIds }, project: projectId });
    if (layers.length !== layerIds.length) {
        return next(new AppError('Some layers do not belong to this project', 400));
    }

    // Update order field for each layer document
    const updatePromises = layerIds.map((layerId, index) => 
        Layer.findByIdAndUpdate(layerId, { order: index }, { new: true })
    );

    await Promise.all(updatePromises);

    // Update the project's layers array to match the new order
    project.layers = layerIds;
    await project.save();

    // Get updated layers to return
    const updatedLayers = await Layer.find({ project: projectId }).sort({ order: 1 });

    // Add to project history
    await project.addHistory({
        action: 'layers_reordered',
        description: 'Layers reordered'
    });

    res.status(200).json({
        success: true,
        message: 'Layers reordered successfully',
        data: { layers: updatedLayers }
    });
});


// @desc    Delete layer
// @route   DELETE /api/layers/:layerId
// @access  Private
export const deleteLayer = catchAsync(async (req, res, next) => {
    const { layerId } = req.params;

    if (!layerId) {
        return next(new AppError('Please provide layer ID', 400));
    } 

    const layer = await Layer.findById(layerId).populate('project');

    if (!layer) {
        return next(new AppError('Layer not found', 404));
    }

    if (layer.project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized to delete this layer', 403));
    }

    // Delete from Cloudinary
    try {
        await cloudinary.uploader.destroy(layer.publicId);
        if (layer.maskPublicId) {
            await cloudinary.uploader.destroy(layer.maskPublicId);
        }
    } catch (error) {
        console.warn('Failed to delete layer images from Cloudinary:', error.message);
    }

    // Remove from project's layers array
    await layerProject.findByIdAndUpdate(layer.project._id, {
        $pull: { layers: layer._id }
    });

    // Add to project history before deletion
    await layerProject.findByIdAndUpdate(layer.project._id, {
        $push: {
            history: {
                action: 'layer_deleted',
                layerId: layer._id,
                description: `Deleted layer: ${layer.name}`,
                timestamp: Date.now()
            }
        }
    });

    await layer.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Layer deleted successfully'
    });
});


// @desc    Duplicate layer
// @route   POST /api/layers/:layerId/duplicate
// @access  Private
export const duplicateLayer = catchAsync(async (req, res, next) => {
    const { layerId } = req.params;

    const originalLayer = await Layer.findById(layerId).populate('project');

    if (!originalLayer) {
        return next(new AppError('Layer not found', 404));
    }

    if (originalLayer.project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized', 403));
    }

    // Create duplicate with new publicId (will need to duplicate image in Cloudinary)
    const duplicateData = originalLayer.toObject();
    delete duplicateData._id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    
    duplicateData.name = `${originalLayer.name} Copy`;
    duplicateData.order = originalLayer.order + 1;
    // Note: In production, you should duplicate the image in Cloudinary
    // and update publicId, imageUrl, maskPublicId, maskUrl accordingly

    const duplicatedLayer = await Layer.create(duplicateData);

    // Add to project
    await layerProject.findByIdAndUpdate(originalLayer.project._id, {
        $push: { layers: duplicatedLayer._id }
    });

    res.status(201).json({
        success: true,
        message: 'Layer duplicated successfully',
        data: { layer: duplicatedLayer }
    });
});