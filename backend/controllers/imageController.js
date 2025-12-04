import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import { cloudinary } from '../config/cloudinary.js';
import Image from '../models/Image.js';
import layerProject from '../models/Project.js';
import seqAIProject from '../models/AIProject.js';
import Layer from '../models/Layer.js';
import { separateLayersInternal } from './aiOperationsController.js';





// @desc    Upload image - Handles both layer-based and AI sequential projects
// @route   POST /api/v1/adobe-ps/images/upload
// @access  Private
export const uploadImage = catchAsync(async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('Please upload an image', 400));
    }

    const { projectId, projectType, layerName, layerType } = req.body;

    // projectType: 'layer-based' or 'ai-sequential'
    const isAIProject = projectType === 'ai-sequential';

    // projectId is required for both types
    if (!projectId) {
        return next(new AppError('Please provide projectId', 400));
    }

    // Verify project exists and user owns it
    let project = null;
    if (isAIProject) {
        project = await seqAIProject.findById(projectId);
    } else {
        project = await layerProject.findById(projectId);
    }

    if (!project) {
        return next(new AppError('layerProject not found', 404));
    }

    if (project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized to add to this project', 403));
    }

    // Save image metadata to database
    const image = await Image.create({
        user: req.user._id,
        publicId: req.file.filename,
        imageUrl: req.file.path,
        format: req.file.format,
        width: req.file.width,
        height: req.file.height,
        size: req.file.bytes,
    });

    // ==========================================
    // AI SEQUENTIAL PROJECT - Simple Upload
    // ==========================================
    if (isAIProject) {
        console.log('🤖 AI Sequential layerProject - Uploading image and linking to project...');

        // Set image to AI project 
        project.originalImage = {
            imageUrl: image.imageUrl,
            publicId: image.publicId,
            width: image.width,
            height: image.height,
            format: image.format,
            size: image.size
        };

        project.currentImage = {
            imageUrl: image.imageUrl,
            publicId: image.publicId,
            width: image.width,
            height: image.height,
            format: image.format,
            size: image.size
        };

        project.thumbnail = {
            imageUrl: image.imageUrl,
            publicId: image.publicId
        };

        await project.save();

        return res.status(201).json({
            success: true,
            message: 'Image uploaded and linked to AI project successfully',
            data: {
                projectId: project._id,
                image: {
                    id: image._id,
                    imageUrl: image.imageUrl,
                    publicId: image.publicId,
                    format: image.format,
                    width: image.width,
                    height: image.height,
                    size: image.size,
                    createdAt: image.createdAt
                }
            }
        });
    }

    // ==========================================
    // LAYER-BASED PROJECT - Complex Upload with Layers
    // ==========================================
    console.log('🎨 Layer-Based layerProject - Creating layers...');

    // Check if this is the first image in the project
    const existingLayersCount = await Layer.countDocuments({ project: projectId });
    const isFirstImage = existingLayersCount === 0;

    let layers = [];

    if (isFirstImage) {
        console.log('🎨 First image detected - Separating into background and foreground layers...');

        // Check if image URL exists
        if (!image.imageUrl) {
            return next(new AppError('Image URL not found for processing', 404));
        }

        // Call AI function to separate layers - it will automatically determine model type using Gemini
        const separationResult = await separateLayersInternal(image.imageUrl, projectId);

        const { foreground, background } = separationResult;

        // Save both separated images to database
        const [foregroundImage, backgroundImage] = await Promise.all([
            Image.create({
                user: req.user._id,
                publicId: foreground.publicId,
                imageUrl: foreground.imageUrl,
                format: foreground.format,
                width: foreground.width,
                height: foreground.height,
                size: foreground.size,
            }),
            Image.create({
                user: req.user._id,
                publicId: background.publicId,
                imageUrl: background.imageUrl,
                format: background.format,
                width: background.width,
                height: background.height,
                size: background.size,
            })
        ]);

        // Create background layer (order: 0 - bottom)
        const backgroundLayer = await Layer.create({
            project: projectId,
            name: 'Background',
            type: 'background',
            imageUrl: backgroundImage.imageUrl,
            publicId: backgroundImage.publicId,
            order: 0,
            visible: true,
            opacity: 100,
            blendMode: 'normal',
            position: { x: 0, y: 0 },
            dimensions: {
                width: backgroundImage.width,
                height: backgroundImage.height
            },
            transformations: {
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                flipX: false,
                flipY: false
            },
            metadata: {
                format: backgroundImage.format,
                size: backgroundImage.size,
                originalPublicId: image.publicId
            }
        });

        // Create foreground layer (order: 1 - top)
        const foregroundLayer = await Layer.create({
            project: projectId,
            name: 'Subject',
            type: 'foreground',
            imageUrl: foregroundImage.imageUrl,
            publicId: foregroundImage.publicId,
            order: 1,
            visible: true,
            opacity: 100,
            blendMode: 'normal',
            position: { x: 0, y: 0 },
            dimensions: {
                width: foregroundImage.width,
                height: foregroundImage.height
            },
            transformations: {
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                flipX: false,
                flipY: false
            },
            metadata: {
                format: foregroundImage.format,
                size: foregroundImage.size,
                originalPublicId: image.publicId
            }
        });

        layers = [backgroundLayer, foregroundLayer];

        // Add both layers to project
        project.layers.push(backgroundLayer._id, foregroundLayer._id);
        await project.save();

        // Add to history
        await project.addHistory({
            action: 'layers_separated',
            description: 'First image uploaded and separated into background and foreground layers'
        });

        console.log('✅ First image separated into 2 layers successfully');

        res.status(201).json({
            success: true,
            message: 'First image uploaded and separated into 2 layers (Background + Subject)',
            data: {
                originalImage: {
                    id: image._id,
                    imageUrl: image.imageUrl,
                    publicId: image.publicId,
                    format: image.format,
                    width: image.width,
                    height: image.height,
                    size: image.size
                },
                layers: [
                    {
                        id: backgroundLayer._id,
                        name: backgroundLayer.name,
                        type: backgroundLayer.type,
                        order: backgroundLayer.order,
                        imageUrl: backgroundLayer.imageUrl
                    },
                    {
                        id: foregroundLayer._id,
                        name: foregroundLayer.name,
                        type: foregroundLayer.type,
                        order: foregroundLayer.order,
                        imageUrl: foregroundLayer.imageUrl
                    }
                ]
            }
        });

    } else {
        console.log('📷 Subsequent image - Creating single layer...');

        // For subsequent uploads, create just one layer
        const highestOrderLayer = await Layer.findOne({ project: projectId })
            .sort({ order: -1 })
            .select('order');
        
        const newOrder = highestOrderLayer ? highestOrderLayer.order + 1 : 0;

        const layer = await Layer.create({
            project: projectId,
            name: layerName || `Layer ${newOrder + 1}`,
            type: layerType || 'custom',
            imageUrl: image.imageUrl,
            publicId: image.publicId,
            order: newOrder,
            visible: true,
            opacity: 100,
            blendMode: 'normal',
            position: { x: 0, y: 0 },
            dimensions: {
                width: image.width,
                height: image.height
            },
            transformations: {
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                flipX: false,
                flipY: false
            },
            metadata: {
                format: image.format,
                size: image.size,
                originalPublicId: image.publicId
            }
        });

        layers = [layer];

        // Add layer to project
        project.layers.push(layer._id);
        await project.save();

        // Add to history
        await project.addHistory({
            action: 'layer_created',
            layerId: layer._id,
            description: `Image uploaded and layer created: ${layer.name}`
        });

        console.log('✅ Single layer created successfully');

        res.status(201).json({
            success: true,
            message: 'Image uploaded and layer created',
            data: {
                image: {
                    id: image._id,
                    imageUrl: image.imageUrl,
                    publicId: image.publicId,
                    format: image.format,
                    width: image.width,
                    height: image.height,
                    size: image.size,
                    createdAt: image.createdAt
                },
                layer: {
                    id: layer._id,
                    name: layer.name,
                    type: layer.type,
                    order: layer.order,
                    visible: layer.visible,
                    opacity: layer.opacity
                }
            }
        });
    }
});




// @desc    Upload multiple images and create layers
// @route   POST /api/v1/adobe-ps/images/upload-multiple
// @access  Private
export const uploadMultipleImages = catchAsync(async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return next(new AppError('Please upload at least one image', 400));
    }

    const { projectId } = req.body;

    // Validation - projectId is required
    if (!projectId) {
        return next(new AppError('Please provide projectId', 400));
    }

    // Verify project exists and user owns it
    const project = await layerProject.findById(projectId);

    if (!project) {
        return next(new AppError('layerProject not found', 404));
    }

    if (project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized to add to this project', 403));
    }

    // Save all images to database
    const imagePromises = req.files.map(file => 
        Image.create({
            user: req.user._id,
            publicId: file.filename,
            imageUrl: file.path,
            format: file.format,
            width: file.width,
            height: file.height,
            size: file.bytes,
        })
    );
    
    const images = await Promise.all(imagePromises);

    // Get current highest order
    const highestOrderLayer = await Layer.findOne({ project: projectId })
        .sort({ order: -1 })
        .select('order');
    
    let currentOrder = highestOrderLayer ? highestOrderLayer.order + 1 : 0;

    // Create layer for each image
    const layerPromises = images.map((image, index) => 
        Layer.create({
            project: projectId,
            name: `Layer ${currentOrder + index + 1}`,
            type: 'custom',
            imageUrl: image.imageUrl,
            publicId: image.publicId,
            order: currentOrder + index,
            visible: true,
            opacity: 100,
            blendMode: 'normal',
            position: { x: 0, y: 0 },
            dimensions: {
                width: image.width,
                height: image.height
            },
            transformations: {
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                flipX: false,
                flipY: false
            },
            metadata: {
                format: image.format,
                size: image.size,
                originalPublicId: image.publicId
            }
        })
    );

    const layers = await Promise.all(layerPromises);

    // Add all layers to project
    project.layers.push(...layers.map(l => l._id));
    await project.save();

    // Add to history
    await project.addHistory({
        action: 'multiple_layers_created',
        description: `${layers.length} images uploaded and layers created`
    });

    res.status(201).json({
        success: true,
        message: `${images.length} images uploaded and ${layers.length} layers created`,
        data: {
            images: images.map(img => ({
                id: img._id,
                imageUrl: img.imageUrl,
                publicId: img.publicId,
                format: img.format,
                width: img.width,
                height: img.height,
                size: img.size,
                createdAt: img.createdAt
            })),
            layers: layers.map(layer => ({
                id: layer._id,
                name: layer.name,
                type: layer.type,
                order: layer.order
            }))
        }
    });
});



// @desc    Delete image
// @route   DELETE /api/v1/adobe-ps/images/:publicId
// @access  Private
export const deleteImage = catchAsync(async (req, res, next) => {
    const { publicId } = req.params;

    if (!publicId) {
        return next(new AppError('Please provide image public ID', 400));
    }

    // Find image in database
    const image = await Image.findOne({ publicId });

    if (!image) {
        return next(new AppError('Image not found', 404));
    }

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result !== 'ok') {
        return next(new AppError('Failed to delete image from Cloudinary', 500));
    }

    // Delete from database
    await Image.findByIdAndDelete(image._id);

    res.status(200).json({
        success: true,
        message: 'Image deleted successfully'
    });
});



// @desc    Get image details
// @route   GET /api/v1/adobe-ps/images/:publicId
// @access  Private
export const getImageDetails = catchAsync(async (req, res, next) => {
    const { publicId } = req.params;

    if (!publicId) {
        return next(new AppError('Please provide image public ID', 400));
    }

    // Get image from database
    const image = await Image.findOne({ publicId }).populate('user', 'name email');

    if (!image) {
        return next(new AppError('Image not found', 404));
    }

    res.status(200).json({
        success: true,
        data: {
            id: image._id,
            publicId: image.publicId,
            url: image.imageUrl,
            format: image.format,
            width: image.width,
            height: image.height,
            size: image.size,
            user: image.user,
            createdAt: image.createdAt,
            updatedAt: image.updatedAt
        }
    });
});




// @desc    Crop image and replace original
// @route   PATCH /api/v1/adobe-ps/images/crop
// @access  Private
export const cropImage = catchAsync(async (req, res, next) => {
    const { publicId, x, y, width, height } = req.body;

    /*  x - Starting X coordinate (left edge)
        y - Starting Y coordinate (top edge)
        width - How wide the crop should be
        height - How tall the crop should be 
    */


    // Validation
    if (!publicId) {
        return next(new AppError('Please provide image public ID', 400));
    }

    if (x === undefined || y === undefined || !width || !height) {
        return next(new AppError('Please provide crop coordinates (x, y, width, height)', 400));
    }

    // Validate coordinates are positive numbers
    if (x < 0 || y < 0 || width <= 0 || height <= 0) {
        return next(new AppError('Invalid crop coordinates', 400));
    }

    // Find original image in database
    const image = await Image.findOne({ publicId });

    if (!image) {
        return next(new AppError('Image not found', 404));
    }

    const oldPublicId = image.publicId;

    // Upload cropped version to Cloudinary as a new image
    const cropResult = await cloudinary.uploader.explicit(publicId, {
        type: 'upload',
        eager: [{
            crop: 'crop',
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(width),
            height: Math.round(height)
        }],
        eager_async: false
    });

    const croppedImageData = cropResult.eager[0];
    const newPublicId = cropResult.public_id;

    // Delete old image from Cloudinary
    await cloudinary.uploader.destroy(oldPublicId);

    // Update image record in database with cropped version
    image.publicId = newPublicId;
    image.imageUrl = croppedImageData.secure_url;
    image.width = croppedImageData.width;
    image.height = croppedImageData.height;
    image.size = croppedImageData.bytes;
    image.format = cropResult.format;

    await image.save();

    res.status(200).json({
        success: true,
        message: 'Image cropped and updated successfully',
        data: {
            id: image._id,
            publicId: image.publicId,
            imageUrl: image.imageUrl,
            width: image.width,
            height: image.height,
            size: image.size,
            format: image.format,
            updatedAt: image.updatedAt
        }
    });
});

