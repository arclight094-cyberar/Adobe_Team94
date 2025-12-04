import Layer from '../models/Layer.js';
import layerProject from '../models/Project.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import { analyzeForAutoEnhancement } from '../AI/LayerAiGemini.js';
import { cloudinary } from '../config/cloudinary.js';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to download image
async function downloadImageFromCloudinary(imageUrl) {
    const tempDir = path.join(__dirname, '..', 'image', 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const filename = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const filepath = path.join(tempDir, filename);

    const response = await axios({
        method: 'get',
        url: imageUrl,
        responseType: 'stream'
    });

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filepath));
        writer.on('error', reject);
    });
}

// Helper to cleanup temp files
async function cleanupTempFile(filepath) {
    if (filepath && fs.existsSync(filepath)) {
        try {
            await fs.promises.unlink(filepath);
        } catch (err) {
            console.warn(`Failed to delete temp file ${filepath}:`, err.message);
        }
    }
}

// @desc    Auto-enhance - merge visible layers and analyze with Gemini
// @route   POST /api/v1/adobe-ps/gemini/auto-enhance/:projectId
// @access  Private
export const autoEnhanceAnalysis = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;

    console.log('🎨 Starting auto-enhancement analysis for project:', projectId);

    // Find project and verify ownership
    const project = await layerProject.findById(projectId);
    if (!project) {
        return next(new AppError('Project not found', 404));
    }

    if (project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized to analyze this project', 403));
    }

    // Get all visible layers sorted by order (bottom to top)
    const layers = await Layer.find({ 
        project: projectId, 
        visible: true 
    }).sort({ order: 1 });

    if (layers.length === 0) {
        return next(new AppError('No visible layers found in project', 404));
    }

    const tempFiles = [];

    try {
        // Step 1: Download all visible layer images
        console.log(`📥 Downloading ${layers.length} visible layers...`);
        const layerImagePaths = [];
        
        for (const layer of layers) {
            const imagePath = await downloadImageFromCloudinary(layer.imageUrl);
            tempFiles.push(imagePath);
            layerImagePaths.push(imagePath);
        }

        // Step 2: Merge layers into single composite image
        console.log('🖼️ Merging layers...');
        
        // Get canvas dimensions from project or use first layer dimensions
        const canvasWidth = project.canvas?.width || layers[0].dimensions.width;
        const canvasHeight = project.canvas?.height || layers[0].dimensions.height;

        // Create base canvas
        let composite = sharp({
            create: {
                width: canvasWidth,
                height: canvasHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        });

        // Build composite layers array
        const compositeInputs = [];
        
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            const imagePath = layerImagePaths[i];
            
            // Calculate safe position and dimensions to ensure layer fits within canvas
            let layerX = Math.max(0, Math.round(layer.position.x));
            let layerY = Math.max(0, Math.round(layer.position.y));
            let layerWidth = layer.dimensions.width;
            let layerHeight = layer.dimensions.height;
            
            // Ensure layer doesn't extend beyond canvas boundaries
            if (layerX + layerWidth > canvasWidth) {
                layerWidth = Math.max(1, canvasWidth - layerX);
            }
            if (layerY + layerHeight > canvasHeight) {
                layerHeight = Math.max(1, canvasHeight - layerY);
            }
            
            // Clamp position to canvas bounds
            layerX = Math.min(layerX, canvasWidth - 1);
            layerY = Math.min(layerY, canvasHeight - 1);
            
            // Read and process layer image with safe dimensions
            const layerBuffer = await sharp(imagePath)
                .resize(layerWidth, layerHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .toBuffer();
            
            compositeInputs.push({
                input: layerBuffer,
                top: layerY,
                left: layerX,
                blend: layer.blendMode === 'normal' ? 'over' : 'over' // Sharp supports limited blend modes
            });
        }

        // Apply all layers to composite
        const mergedImageBuffer = await composite
            .composite(compositeInputs)
            .jpeg({ quality: 90 })
            .toBuffer();

        console.log('✅ Layers merged successfully');

        // Step 3: Send merged image to Gemini for analysis
        console.log('🤖 Analyzing merged image with Gemini...');
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            return next(new AppError('Gemini API key not configured', 500));
        }

        const analysis = await analyzeForAutoEnhancement(geminiApiKey, mergedImageBuffer, 'image/jpeg');
        console.log('✅ Gemini analysis complete:', JSON.stringify(analysis, null, 2));

        // Step 4: Return analysis with enhancement order
        res.status(200).json({
            success: true,
            message: 'Auto-enhancement analysis complete',
            data: {
                project: {
                    id: project._id,
                    name: project.name
                },
                layersAnalyzed: layers.length,
                analysis: {
                    needs_enhancement: analysis.needs_enhancement,
                    enhancements: analysis.enhancements,
                    priority_order: analysis.priority_order,
                    overall_quality: analysis.overall_quality,
                    detailed_analysis: analysis.analysis
                },
                recommendations: {
                    apply_in_order: analysis.priority_order || [],
                    total_steps: (analysis.priority_order || []).length,
                    enhancement_details: analysis.priority_order?.map(enhancement => ({
                        type: enhancement,
                        severity: analysis.analysis?.[enhancement]?.severity || 'unknown',
                        needed: analysis.analysis?.[enhancement]?.needed || false
                    })) || []
                }
            }
        });

    } catch (error) {
        console.error('❌ Auto-enhancement analysis failed:', error);
        return next(new AppError(`Auto-enhancement analysis failed: ${error.message}`, 500));
    } finally {
        // Cleanup all temp files
        for (const tempFile of tempFiles) {
            await cleanupTempFile(tempFile);
        }
    }
});


// @desc    Apply auto-enhancement operations sequentially
// @route   POST /api/v1/adobe-ps/gemini/apply-enhancements/:projectId
// @access  Private
export const applyEnhancements = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;
    const { enhancementOrder } = req.body; // Array: ["low_light_enhancement", "denoise", "face_restoration"]

    if (!enhancementOrder || !Array.isArray(enhancementOrder) || enhancementOrder.length === 0) {
        return next(new AppError('Please provide enhancementOrder array', 400));
    }

    console.log('🎨 Starting sequential enhancement application for project:', projectId);

    // Find project and verify ownership
    const project = await layerProject.findById(projectId);
    if (!project) {
        return next(new AppError('Project not found', 404));
    }

    if (project.user.toString() !== req.user._id.toString()) {
        return next(new AppError('Not authorized to modify this project', 403));
    }

    // Get all visible layers sorted by order
    const layers = await Layer.find({ 
        project: projectId, 
        visible: true 
    }).sort({ order: 1 });

    if (layers.length === 0) {
        return next(new AppError('No visible layers found in project', 404));
    }

    const tempFiles = [];
    const totalStartTime = Date.now();

    try {
        // Step 1: Download all visible layer images and merge
        console.log(`📥 Downloading ${layers.length} visible layers...`);
        const layerImagePaths = [];
        
        for (const layer of layers) {
            const imagePath = await downloadImageFromCloudinary(layer.imageUrl);
            tempFiles.push(imagePath);
            layerImagePaths.push(imagePath);
        }

        // Step 2: Merge layers into composite
        console.log('🖼️ Merging layers...');
        const canvasWidth = project.canvas?.width || layers[0].dimensions.width;
        const canvasHeight = project.canvas?.height || layers[0].dimensions.height;

        let composite = sharp({
            create: {
                width: canvasWidth,
                height: canvasHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        });

        const compositeInputs = [];
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            const imagePath = layerImagePaths[i];
            
            // Calculate safe position and dimensions to ensure layer fits within canvas
            let layerX = Math.max(0, Math.round(layer.position.x));
            let layerY = Math.max(0, Math.round(layer.position.y));
            let layerWidth = layer.dimensions.width;
            let layerHeight = layer.dimensions.height;
            
            // Ensure layer doesn't extend beyond canvas boundaries
            if (layerX + layerWidth > canvasWidth) {
                layerWidth = Math.max(1, canvasWidth - layerX);
            }
            if (layerY + layerHeight > canvasHeight) {
                layerHeight = Math.max(1, canvasHeight - layerY);
            }
            
            // Clamp position to canvas bounds
            layerX = Math.min(layerX, canvasWidth - 1);
            layerY = Math.min(layerY, canvasHeight - 1);
            
            // Read and process layer image with safe dimensions
            const layerBuffer = await sharp(imagePath)
                .resize(layerWidth, layerHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .toBuffer();
            
            compositeInputs.push({
                input: layerBuffer,
                top: layerY,
                left: layerX,
                blend: 'over'
            });
        }

        const uniqueId = Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        const compositeFilename = `composite_${uniqueId}.jpg`;
        const compositePath = path.join(path.dirname(layerImagePaths[0]), compositeFilename);

        await composite
            .composite(compositeInputs)
            .jpeg({ quality: 95 })
            .toFile(compositePath);

        tempFiles.push(compositePath);
        console.log('✅ Composite created');

        // Step 3: Upload composite to Cloudinary (will be used as input for first operation)
        console.log('☁️ Uploading composite to Cloudinary...');
        const compositeUpload = await cloudinary.uploader.upload(compositePath, {
            folder: 'adobe-ps-uploads',
            resource_type: 'image',
            public_id: `composite_${projectId}_${uniqueId}`
        });

        let currentImageUrl = compositeUpload.secure_url;
        const appliedEnhancements = [];
        const enhancementResults = [];

        // Step 4: Apply each enhancement sequentially
        for (let i = 0; i < enhancementOrder.length; i++) {
            const enhancement = enhancementOrder[i];
            console.log(`⚙️ Step ${i + 1}/${enhancementOrder.length}: Applying ${enhancement}...`);
            const stepStartTime = Date.now();

            try {
                const result = await applyEnhancement(enhancement, currentImageUrl, uniqueId);
                
                appliedEnhancements.push(enhancement);
                enhancementResults.push({
                    step: i + 1,
                    type: enhancement,
                    outputImageUrl: result.imageUrl,
                    processingTime: `${((Date.now() - stepStartTime) / 1000).toFixed(2)}s`
                });

                // Update current image for next operation
                currentImageUrl = result.imageUrl;
                console.log(`✅ ${enhancement} completed`);

            } catch (error) {
                console.error(`❌ ${enhancement} failed:`, error.message);
                enhancementResults.push({
                    step: i + 1,
                    type: enhancement,
                    error: error.message,
                    processingTime: `${((Date.now() - stepStartTime) / 1000).toFixed(2)}s`
                });
                // Continue with next enhancement even if one fails
            }
        }

        const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(2);
        console.log(`🎉 Enhancement pipeline completed in ${totalTime}s`);

        res.status(200).json({
            success: true,
            message: 'Enhancements applied successfully',
            data: {
                project: {
                    id: project._id,
                    name: project.name
                },
                originalCompositeUrl: compositeUpload.secure_url,
                finalImageUrl: currentImageUrl,
                appliedEnhancements,
                enhancementResults,
                totalSteps: enhancementOrder.length,
                successfulSteps: appliedEnhancements.length,
                totalProcessingTime: `${totalTime}s`
            }
        });

    } catch (error) {
        console.error('❌ Enhancement application failed:', error);
        return next(new AppError(`Enhancement application failed: ${error.message}`, 500));
    } finally {
        // Cleanup all temp files
        for (const tempFile of tempFiles) {
            await cleanupTempFile(tempFile);
        }
    }
});


// Helper function to apply individual enhancement
async function applyEnhancement(enhancementType, imageUrl, uniqueId) {
    const AI_CONTAINERS = {
        LOWLIGHT: { name: 'lowlight-service', image: 'sameer513/lowlight-cpu-bullseye' },
        FACE_RESTORE: { name: 'codeformer-service', image: 'sameer513/codeformer_app' },
        ENHANCE: { name: 'nafnet-service', image: 'sameer513/nafnet-image' }
    };

    const tempDir = path.join(__dirname, '..', 'image', 'temp');
    const inputFilename = `input_${uniqueId}_${enhancementType}.jpg`;
    const inputPath = path.join(tempDir, inputFilename);
    const outputFilename = `output_${uniqueId}_${enhancementType}.jpg`;
    const outputPath = path.join(tempDir, outputFilename);

    // Download image
    const response = await axios({ method: 'get', url: imageUrl, responseType: 'stream' });
    const writer = fs.createWriteStream(inputPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });

    // Ensure container is running
    async function ensureContainerRunning(containerName, imageName) {
        try {
            // Check if container exists and is running
            const { stdout } = await execAsync(`docker ps -a --filter "name=${containerName}" --format "{{.Names}}"`);
            if (stdout.trim() === containerName) {
                // Container exists, try to start it
                try {
                    await execAsync(`docker start ${containerName}`);
                    console.log(`✅ Container ${containerName} started`);
                } catch (startErr) {
                    // Container might already be running
                    console.log(`ℹ️ Container ${containerName} is already running`);
                }
            } else {
                // Container doesn't exist, create it
                console.log(`📦 Creating container ${containerName}...`);
                await execAsync(`docker run -d --name ${containerName} ${imageName} tail -f /dev/null`);
                console.log(`✅ Container ${containerName} created`);
            }
        } catch (err) {
            // If check fails, try to create container
            console.log(`📦 Creating container ${containerName} (check failed)...`);
            await execAsync(`docker run -d --name ${containerName} ${imageName} tail -f /dev/null`).catch(createErr => {
                // Container might already exist
                if (!createErr.message.includes('already exists')) {
                    throw createErr;
                }
            });
        }
    }

    let uploadResult;

    switch (enhancementType) {
        case 'low_light_enhancement': {
            const container = AI_CONTAINERS.LOWLIGHT;
            console.log(`🔧 Low light enhancement - Container: ${container.name}`);
            
            // Ensure container is running
            await ensureContainerRunning(container.name, container.image);
            
            // Verify container is actually running
            try {
                const { stdout: statusOut } = await execAsync(`docker ps --filter "name=${container.name}" --format "{{.Names}}"`);
                if (!statusOut.trim().includes(container.name)) {
                    throw new Error(`Container ${container.name} is not running`);
                }
            } catch (statusErr) {
                throw new Error(`Failed to verify container ${container.name}: ${statusErr.message}`);
            }
            
            // Copy input image to container
            console.log(`📤 Copying image to container ${container.name}...`);
            const copyCommand = `docker cp "${inputPath}" ${container.name}:/app/${inputFilename}`;
            console.log(`Copy command: ${copyCommand}`);
            await execAsync(copyCommand);
            
            // Run AI model inside container
            console.log(`🔍 Running low light enhancement...`);
            const processCommand = `docker exec ${container.name} python infer.py --weights best_model_LOLv1.pth --input ${inputFilename} --output ${outputFilename} --brightness 0.5`;
            console.log(`Process command: ${processCommand}`);
            
            try {
                const { stdout, stderr } = await execAsync(processCommand, {
                    maxBuffer: 50 * 1024 * 1024
                });
                
                if (stdout) console.log('Model output:', stdout.trim());
                if (stderr && !stderr.includes('Saved:') && !stderr.includes('Resized')) {
                    console.warn('Model warnings:', stderr.trim());
                }
            } catch (execErr) {
                console.error(`❌ Command execution failed: ${execErr.message}`);
                console.error(`Command was: ${processCommand}`);
                throw new Error(`Low light enhancement failed: ${execErr.message}`);
            }
            
            // Copy result back from container
            console.log(`📥 Copying result from container...`);
            await execAsync(`docker cp ${container.name}:/app/${outputFilename} "${outputPath}"`);
            
            // Verify output file exists
            if (!fs.existsSync(outputPath)) {
                throw new Error(`Output file was not created: ${outputPath}`);
            }
            
            // Clean up files inside container
            await execAsync(`docker exec ${container.name} rm -f /app/${inputFilename} /app/${outputFilename}`).catch(() => {});
            break;
        }

        case 'denoise': {
            const container = AI_CONTAINERS.ENHANCE;
            await ensureContainerRunning(container.name, container.image);
            await execAsync(`docker cp "${inputPath}" ${container.name}:/app/demo/${inputFilename}`);
            await execAsync(
                `docker exec ${container.name} bash -c "export PYTHONPATH=/app:$PYTHONPATH && python3 basicsr/demo.py -opt options/test/SIDD/NAFNet-width64.yml --input_path ./demo/${inputFilename} --output_path ./demo/${outputFilename}"`,
                { maxBuffer: 50 * 1024 * 1024 }
            );
            await execAsync(`docker cp ${container.name}:/app/demo/${outputFilename} "${outputPath}"`);
            await execAsync(`docker exec ${container.name} rm -f /app/demo/${inputFilename} /app/demo/${outputFilename}`).catch(() => {});
            break;
        }

        case 'deblur': {
            const container = AI_CONTAINERS.ENHANCE;
            await ensureContainerRunning(container.name, container.image);
            await execAsync(`docker cp "${inputPath}" ${container.name}:/app/demo/${inputFilename}`);
            await execAsync(
                `docker exec ${container.name} bash -c "export PYTHONPATH=/app:$PYTHONPATH && python3 basicsr/demo.py -opt options/test/REDS/NAFNet-width64.yml --input_path ./demo/${inputFilename} --output_path ./demo/${outputFilename}"`,
                { maxBuffer: 50 * 1024 * 1024 }
            );
            await execAsync(`docker cp ${container.name}:/app/demo/${outputFilename} "${outputPath}"`);
            await execAsync(`docker exec ${container.name} rm -f /app/demo/${inputFilename} /app/demo/${outputFilename}`).catch(() => {});
            break;
        }

        case 'face_restoration': {
            const container = AI_CONTAINERS.FACE_RESTORE;
            await ensureContainerRunning(container.name, container.image);
            await execAsync(`docker cp "${inputPath}" ${container.name}:/cf/input/${inputFilename}`);
            await execAsync(
                `docker exec ${container.name} bash -c "cd /cf/CodeFormer && python inference_codeformer.py --w 0.7 --test_path /cf/input"`,
                { maxBuffer: 50 * 1024 * 1024 }
            );
            const inputBasename = path.parse(inputFilename).name;
            await execAsync(`docker cp ${container.name}:/cf/output/input_0.7/final_results/${inputBasename}.png "${outputPath}"`);
            await execAsync(`docker exec ${container.name} rm -rf /cf/input/${inputFilename} /cf/output/input_0.7`).catch(() => {});
            break;
        }

        default:
            throw new Error(`Unknown enhancement type: ${enhancementType}`);
    }

    // Upload result to Cloudinary
    uploadResult = await cloudinary.uploader.upload(outputPath, {
        folder: 'adobe-ps-uploads',
        resource_type: 'image',
        public_id: `enhanced_${uniqueId}_${enhancementType}`
    });

    // Cleanup temp files
    await fs.promises.unlink(inputPath).catch(() => {});
    await fs.promises.unlink(outputPath).catch(() => {});

    return {
        imageUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height
    };
}
