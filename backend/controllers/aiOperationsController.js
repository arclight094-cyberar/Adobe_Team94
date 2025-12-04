import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import { cloudinary } from '../config/cloudinary.js';
import Image from '../models/Image.js';
import seqAIProject from '../models/AIProject.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import https from 'https';
import { pipeline } from 'stream/promises';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temporary directory for downloaded images during AI operations
const tempImageDir = path.join(__dirname, '..', 'image', 'temp');
fs.mkdir(tempImageDir, { recursive: true }).catch(console.error);

// Helper function for conditional logging
const isDevelopment = (process.env.NODE_ENV || '').trim() === 'development';
const log = {
    info: (...args) => {
        if (isDevelopment) console.log(...args);
    },
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
    timing: (...args) => console.log(...args) // Always log timing info
};

// Docker container configuration for AI models
const AI_CONTAINERS = {
    LOWLIGHT: {
        name: 'lowlight-service',
        image: 'sameer513/lowlight-cpu-bullseye'
    },
    FACE_RESTORE: {
        name: 'codeformer-service',
        image: 'sameer513/codeformer_app'
    },
    ENHANCE: {
        name: 'nafnet-service',
        image: 'sameer513/nafnet-image'
    },
    STYLE_TRANSFER: {
        name: 'style-transfer-service',
        image: 'sameer513/pca-style-transfer-fixed'
    },
    BACKGROUND_REMOVAL: {
        name: 'background-removal-service',
        image: 'sameer513/u2net-inference'
    },
    OBJECT_REMOVAL_SAM: {
        name: 'object-masking-service',
        image: 'sameer513/sam-cpu-final'
    },
    OBJECT_REMOVAL_LAMA: {
        name: 'object-remover-service',
        image: 'sameer513/better-lama'
    },
    BACKGROUND_HARMONIZATION: {
        name: 'pct-net-service',
        image: 'sameer513/pct-net-final'
    }

};

// Helper function to ensure container is running
async function ensureContainerRunning(containerName, imageName) {
    try {
        // Try to start existing container
        await execAsync(`docker start ${containerName}`);
        log.info(`Container ${containerName} restarted`);
    } catch (err) {
        // Container doesn't exist, create it
        log.info(`Creating container ${containerName}...`);
        await execAsync(`docker run -d --name ${containerName} ${imageName} tail -f /dev/null`);
        log.info(`Container ${containerName} created`);
    }
}

// Helper function to download image from Cloudinary to temporary local file
async function downloadImageFromCloudinary(imageUrl, imageId) {
    const uniqueId = Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const filename = `temp_${imageId}_${uniqueId}${ext}`;
    const localPath = path.join(tempImageDir, filename);

    log.info(`📥 Downloading image from Cloudinary: ${imageUrl}`);
    log.info(`💾 Saving to temporary file: ${localPath}`);

    return new Promise((resolve, reject) => {
        https.get(imageUrl, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download image: ${response.statusCode}`));
            }

            const fileStream = fsSync.createWriteStream(localPath);
            pipeline(response, fileStream)
                .then(() => {
                    log.info(`✅ Image downloaded successfully: ${localPath}`);
                    resolve(localPath);
                })
                .catch(reject);
        }).on('error', reject);
    });
}

// Helper function to safely cleanup temporary files
async function cleanupTempFile(filePath) {
    if (!filePath) return;
    
    try {
        await fs.unlink(filePath);
        log.info(`🗑️ Cleaned up temp file: ${path.basename(filePath)}`);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            log.warn(`⚠️ Failed to delete temp file ${path.basename(filePath)}: ${err.message}`);
        }
    }
}

// Internal function for layer separation (used by imageController when user uploads image)
// Two-stage pipeline: u2net (foreground extraction) → LaMa (background inpainting)
// Model type is automatically determined by Gemini image classification
export async function separateLayersInternal(imageUrl, projectId) {
    // Download image from Cloudinary to temporary local file
    const imageId = `project_${projectId}_${Date.now()}`;
    let localPath;
    let downloadedFile = false;
    
    try {
        localPath = await downloadImageFromCloudinary(imageUrl, imageId);
        downloadedFile = true;
    } catch (downloadErr) {
        throw new Error(`Failed to download image from Cloudinary: ${downloadErr.message}`);
    }

    // Determine model type using Gemini classification
    let modelType = 'general'; // Default to general model
    try {
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            log.warn('⚠️ GEMINI_API_KEY not found, using default: general');
            modelType = 'general';
        } else {
            const { classifyImage } = await import('../AI/LayerAiGemini.js');
            const imageBytes = await fs.readFile(localPath);
            
            // Determine MIME type from file extension
            const ext = path.extname(localPath).toLowerCase();
            const mimeType = ext === '.png' ? 'image/png' : 
                            ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                            'image/jpeg'; // Default fallback
            
            log.info('🤖 Classifying image with Gemini to determine model type...');
            
            const classification = await classifyImage(geminiApiKey, imageBytes, mimeType);
            
            if (classification.status === 'success' && classification.image_type) {
                // Use human model if classified as human
                if (classification.image_type === 'human') {
                    modelType = 'human';
                    log.info(`✅ Image classified as: human (confidence: ${classification.confidence || 'unknown'}) - Using human model`);
                } else {
                    // Use general model for objects
                    modelType = 'general';
                    log.info(`✅ Image classified as: ${classification.image_type} (confidence: ${classification.confidence || 'unknown'}) - Using general model`);
                }
            } else {
                log.warn('⚠️ Gemini classification failed, using default: general');
                modelType = 'general';
            }
        }
    } catch (error) {
        // If Gemini fails, fallback to general model
        log.warn(`⚠️ Gemini classification error, using default general model: ${error.message}`);
        modelType = 'general';
    }

    const uniqueId = Date.now() + '_' + Math.random().toString(36).slice(2, 11);

    const foregroundFilename = `foreground_${uniqueId}.png`;
    const foregroundPath = path.join(path.dirname(localPath), foregroundFilename);

    const backgroundFilename = `background_${uniqueId}.png`;
    const backgroundPath = path.join(path.dirname(localPath), backgroundFilename);

    const inputFilename = path.basename(localPath);

    log.info('🎨 Separating layers - Starting two-stage pipeline (u2net → LaMa)...');
    const startTime = Date.now();

    // ========================================
    // STAGE 1: Extract foreground using u2net
    // ========================================
    log.info('📍 Stage 1: Extracting foreground with u2net...');
    const rembgStartTime = Date.now();

    const rembgContainerName = AI_CONTAINERS.BACKGROUND_REMOVAL.name;
    const rembgDockerImage = AI_CONTAINERS.BACKGROUND_REMOVAL.image;

    // Determine model file based on modelType
    // general -> u2net.onnx (for all objects including humans)
    // human -> u2net_human_seg.onnx (optimized for human segmentation)
    const modelFile = modelType === 'human' ? 'u2net_human_seg.onnx' : 'u2net.onnx';
    log.info(`Using u2net model: ${modelFile} (type: ${modelType})`);

    // Ensure container is running
    await ensureContainerRunning(rembgContainerName, rembgDockerImage);

    // Copy input image to container's samples directory
    log.info('📤 Copying image to container...');
    await execAsync(`docker cp "${localPath}" ${rembgContainerName}:/app/samples/${inputFilename}`);

    // Extract foreground (subject with transparent background) using python app.py
    log.info('🔍 Extracting foreground/subject with transparent background...');
    const processCommand = `docker exec ${rembgContainerName} python app.py samples/${inputFilename} samples/${foregroundFilename} models/${modelFile}`;
    const { stdout, stderr } = await execAsync(processCommand, { 
        maxBuffer: 50 * 1024 * 1024 
    });

    if (stdout) {
        log.info('Model output:', stdout.trim());
    }
    if (stderr && !stderr.includes('Saved:') && !stderr.includes('Processing')) {
        log.warn('Model warnings:', stderr.trim());
    }

    // Copy foreground back from container
    await execAsync(`docker cp ${rembgContainerName}:/app/samples/${foregroundFilename} "${foregroundPath}"`);

    // Clean up container files
    await execAsync(`docker exec ${rembgContainerName} rm -f /app/samples/${inputFilename} /app/samples/${foregroundFilename}`).catch(() => { });

    // Verify foreground file was created
    await fs.access(foregroundPath);
    const foregroundStats = await fs.stat(foregroundPath);

    if (foregroundStats.size === 0) {
        throw new Error('Failed to extract foreground - file is empty');
    }

    const u2netTime = ((Date.now() - rembgStartTime) / 1000).toFixed(2);
    log.timing(`[u2net] Foreground extraction completed in ${u2netTime} seconds`);

    // ========================================
    // STAGE 2: Generate background using LaMa
    // ========================================
    log.info('📍 Stage 2: Generating clean background with LaMa inpainting...');
    const lamaStartTime = Date.now();

    const lamaContainerName = AI_CONTAINERS.OBJECT_REMOVAL_LAMA.name;
    const lamaDockerImage = AI_CONTAINERS.OBJECT_REMOVAL_LAMA.image;

    // Ensure LaMa container is running
    await ensureContainerRunning(lamaContainerName, lamaDockerImage);

    // Copy original image to LaMa container
    log.info('📤 Copying original image to LaMa container...');
    await execAsync(`docker cp "${localPath}" ${lamaContainerName}:/app/input/${inputFilename}`);

    // Copy transparent foreground (subject) to LaMa container
    // LaMa will use --subject mode: RGB image + RGB image with transparent background
    log.info('📤 Copying transparent foreground to LaMa container...');
    await execAsync(`docker cp "${foregroundPath}" ${lamaContainerName}:/app/input/${foregroundFilename}`);

    // Run LaMa inpainting with --subject flag (uses transparent PNG to inpaint background)
    // --subject: RGB image + RGB image with transparent background where only subject is colored
    // --dilate 15: Dilates the mask by 15 pixels for better edge blending
    log.info('🌄 Running LaMa inpainting to generate clean background...');
    const lamaCommand = `docker exec ${lamaContainerName} python simple_infer.py --model /app/models/big-lama --image /app/input/${inputFilename} --subject /app/input/${foregroundFilename} --out /app/output/${backgroundFilename} --dilate 15`;
    const { stdout: lamaStdout, stderr: lamaStderr } = await execAsync(lamaCommand, {
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    });

    if (lamaStdout) {
        log.info('LaMa output:', lamaStdout.trim());
    }
    if (lamaStderr) {
        log.warn('LaMa warnings:', lamaStderr.trim());
    }

    // Copy background result back from LaMa container
    log.info('📥 Copying background result from LaMa container...');
    await execAsync(`docker cp ${lamaContainerName}:/app/output/${backgroundFilename} "${backgroundPath}"`);

    // Clean up LaMa container files
    await execAsync(`docker exec ${lamaContainerName} rm -f /app/input/${inputFilename} /app/input/${foregroundFilename} /app/output/${backgroundFilename}`).catch(() => { });

    // Verify background file was created
    await fs.access(backgroundPath);
    const backgroundStats = await fs.stat(backgroundPath);

    if (backgroundStats.size === 0) {
        throw new Error('Failed to generate background - file is empty');
    }

    const lamaTime = ((Date.now() - lamaStartTime) / 1000).toFixed(2);
    log.timing(`[LaMa] Background generation completed in ${lamaTime} seconds`);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log.timing(`[Layer Separation] Total two-stage processing completed in ${totalTime} seconds`);

    // ========================================
    // Upload both layers to Cloudinary
    // ========================================
    log.info('☁️ Uploading separated layers to Cloudinary...');

    const [foregroundUpload, backgroundUpload] = await Promise.all([
        cloudinary.uploader.upload(foregroundPath, {
            folder: 'adobe-ps-layers',
            resource_type: 'image',
            public_id: `${projectId}_foreground_${Date.now()}`
        }),
        cloudinary.uploader.upload(backgroundPath, {
            folder: 'adobe-ps-layers',
            resource_type: 'image',
            public_id: `${projectId}_background_${Date.now()}`
        })
    ]);

    // Clean up local files (including downloaded input file)
    await Promise.all([
        fs.unlink(foregroundPath).catch(() => { }),
        fs.unlink(backgroundPath).catch(() => { }),
        downloadedFile && localPath ? fs.unlink(localPath).catch(() => { }) : Promise.resolve()
    ]);

    log.info('✅ Layers separated successfully with two-stage pipeline');

    return {
        foreground: {
            publicId: foregroundUpload.public_id,
            imageUrl: foregroundUpload.secure_url,
            format: foregroundUpload.format,
            width: foregroundUpload.width,
            height: foregroundUpload.height,
            size: foregroundUpload.bytes
        },
        background: {
            publicId: backgroundUpload.public_id,
            imageUrl: backgroundUpload.secure_url,
            format: backgroundUpload.format,
            width: backgroundUpload.width,
            height: backgroundUpload.height,
            size: backgroundUpload.bytes
        }
    };
}




// @desc    Separate foreground and background from an image (HTTP endpoint)
// @route   POST /api/ai/separate-layers
// @access  Private
// Model type is automatically determined by Gemini image classification
export const separateLayers = catchAsync(async (req, res, next) => {
    const { imageUrl, projectId } = req.body;

    if (!imageUrl || !projectId) {
        return next(new AppError('Image URL and project ID are required', 400));
    }

    const result = await separateLayersInternal(imageUrl, projectId);

    res.status(200).json({
        success: true,
        message: 'Layers separated successfully',
        data: result
    });
});




// @desc    Relight image using AI model
// @route   POST /api/ai/relight
// @access  Private
export const relightImage = catchAsync(async (req, res, next) => {
    const { publicId, brightness = 0.5 } = req.body;

    // Validation
    if (!publicId) {
        return next(new AppError('Please provide image public ID', 400));
    }

    if (brightness < 0.1 || brightness > 3.0) {
        return next(new AppError('Brightness must be between 0.1 and 3.0', 400));
    }

    // Find image in database
    const image = await Image.findOne({ publicId });

    if (!image) {
        return next(new AppError('Image not found', 404));
    }

    if (!image.imageUrl) {
        return next(new AppError('Image URL not found. Please re-upload the image.', 404));
    }

    // Download image from Cloudinary to temporary local file
    let inputPath;
    let downloadedFile = false;
    try {
        inputPath = await downloadImageFromCloudinary(image.imageUrl, image._id.toString());
        downloadedFile = true;
    } catch (downloadErr) {
        return next(new AppError(`Failed to download image from Cloudinary: ${downloadErr.message}`, 500));
    }

    // Prepare paths with unique identifiers to avoid conflicts
    const inputFilename = path.basename(inputPath);
    const uniqueId = Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    const outputFilename = `${path.parse(inputPath).name}_relight_${uniqueId}.${image.format}`;
    const outputPath = path.join(path.dirname(inputPath), outputFilename);

    // Docker configuration - use persistent container
    const containerName = AI_CONTAINERS.LOWLIGHT.name;
    const dockerImage = AI_CONTAINERS.LOWLIGHT.image;

    log.info('Starting AI relight processing with Docker...');
    log.info('Input image:', inputPath);
    log.info('Output will be saved to:', outputPath);

    const startTime = Date.now();

    // Ensure container is running
    await ensureContainerRunning(containerName, dockerImage);

    // Copy input image to container
    log.info('Copying image to Docker container...');
    await execAsync(`docker cp "${inputPath}" ${containerName}:/app/${inputFilename}`);
    log.info('Image copied to container');

    // Run AI model inside container
    log.info('Running AI model (this may take 30-60 seconds)...');
    const processCommand = `docker exec ${containerName} python infer.py --weights best_model_LOLv1.pth --input ${inputFilename} --output ${outputFilename} --brightness ${brightness}`;
    const { stdout, stderr } = await execAsync(processCommand, {
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    });

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log.timing(`[Relight] Processing completed in ${processingTime} seconds`);

    if (stdout) {
        log.info('AI output:', stdout.trim());
    }
    if (stderr && !stderr.includes('Saved:') && !stderr.includes('Resized')) {
        log.warn('AI warnings:', stderr.trim());
    }

    // Copy result back from container
    log.info('Copying result from Docker container...');
    await execAsync(`docker cp ${containerName}:/app/${outputFilename} "${outputPath}"`);
    log.info('Result copied from container');

    // Clean up files inside container to avoid accumulation
    await execAsync(`docker exec ${containerName} rm -f /app/${inputFilename} /app/${outputFilename}`).catch(err => {
        log.warn('Failed to cleanup container files:', err.message);
    });
    log.info('Container files cleaned up');

    // Check if output file was created
    await fs.access(outputPath);
    log.info('Output file created successfully');

    // Upload relit image to Cloudinary
    log.info('Uploading processed image to Cloudinary...');
    const uploadResult = await cloudinary.uploader.upload(outputPath, {
        folder: 'adobe-ps-uploads',
        resource_type: 'image',
        public_id: `relight_${image.publicId}_${Date.now()}`
    });

    // Save relit image to database
    const relitImage = await Image.create({
        user: req.user._id,
        publicId: uploadResult.public_id,
        imageUrl: uploadResult.secure_url,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
        size: uploadResult.bytes,
        localPath: null // Don't store local path for processed images
    });

    // Send response first
    res.status(200).json({
        success: true,
        message: 'Image relit successfully',
        data: {
            originalImageId: image._id,
            originalImageUrl: image.imageUrl,
            relitImageId: relitImage._id,
            relitImageUrl: relitImage.imageUrl,
            publicId: relitImage.publicId,
            brightness: brightness,
            format: relitImage.format,
            width: relitImage.width,
            height: relitImage.height,
            size: relitImage.size,
            createdAt: relitImage.createdAt
        }
    });

    // Clean up local files after response is sent (non-blocking)
    res.on('finish', async () => {
        // Delete AI output image
        if (outputPath) {
            await fs.unlink(outputPath).catch(err => {
                log.warn('Failed to delete output image:', err.message);
            });
            log.info('Cleaned up output image:', outputPath);
        }

        // Delete downloaded input file (if it was downloaded from Cloudinary)
        if (downloadedFile && inputPath) {
            await fs.unlink(inputPath).catch(err => {
                log.warn('Failed to delete downloaded input file:', err.message);
            });
            log.info('Cleaned up downloaded input file:', inputPath);
        }
    });
});




// @desc    Face restoration using CodeFormer
// @route   POST /api/ai/face-restore
// @access  Private
export const faceRestore = catchAsync(async (req, res, next) => {
    const { publicId, fidelity = 0.7 } = req.body;

    // Validation
    if (!publicId) {
        return next(new AppError('Please provide image public ID', 400));
    }

    if (fidelity < 0 || fidelity > 1) {
        return next(new AppError('Fidelity must be between 0 and 1', 400));
    }

    // Find image in database
    const image = await Image.findOne({ publicId });

    // Check if image exists
    if (!image) {
        return next(new AppError('Image not found', 404));
    }

    if (!image.imageUrl) {
        return next(new AppError('Image URL not found. Please re-upload the image.', 404));
    }

    // Download image from Cloudinary to temporary local file
    let inputPath;
    let downloadedFile = false;
    try {
        inputPath = await downloadImageFromCloudinary(image.imageUrl, image._id.toString());
        downloadedFile = true;
    } catch (downloadErr) {
        return next(new AppError(`Failed to download image from Cloudinary: ${downloadErr.message}`, 500));
    }

    // Prepare paths with unique identifiers to avoid conflicts
    const inputFilename = path.basename(inputPath);
    const uniqueId = Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    const outputFilename = `${path.parse(inputPath).name}_restored_${uniqueId}.${image.format}`;
    const outputPath = path.join(path.dirname(inputPath), outputFilename);

    // Docker configuration - use persistent container
    const containerName = AI_CONTAINERS.FACE_RESTORE.name;
    const dockerImage = AI_CONTAINERS.FACE_RESTORE.image;

    log.info('Starting AI face restoration with Docker...');
    log.info('Input image:', inputPath);
    log.info('Output will be saved to:', outputPath);

    const startTime = Date.now();

    // Ensure container is running
    await ensureContainerRunning(containerName, dockerImage);

    // Copy input image to container
    log.info('Copying image to Docker container...');
    await execAsync(`docker cp "${inputPath}" ${containerName}:/cf/input/${inputFilename}`);
    log.info('Image copied to container');

    // Run CodeFormer inside container (without face_upsample and has_aligned to avoid bugs)
    log.info('Running CodeFormer face restoration (this may take 30-60 seconds)...');
    const processCommand = `docker exec ${containerName} bash -c "cd /cf/CodeFormer && python inference_codeformer.py --w ${fidelity} --test_path /cf/input"`;
    const { stdout, stderr } = await execAsync(processCommand, {
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    });

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log.timing(`[FaceRestore] Processing completed in ${processingTime} seconds`);

    if (stdout) {
        log.info('AI output:', stdout.trim());
    }
    if (stderr) {
        log.warn('AI warnings:', stderr.trim());
    }

    // Copy result back from container
    log.info('Copying result from Docker container...');
    // CodeFormer saves to /cf/output/input_{w}/final_results/ and converts to PNG
    const outputFilenameBase = path.parse(inputFilename).name;
    const containerOutputPath = `/cf/output/input_${fidelity}/final_results/${outputFilenameBase}.png`;
    await execAsync(`docker cp ${containerName}:${containerOutputPath} "${outputPath}"`);
    log.info('Result copied from container');

    // Clean up files inside container to avoid accumulation
    await execAsync(`docker exec ${containerName} rm -rf /cf/input/${inputFilename} /cf/output/input_${fidelity}`).catch(err => {
        log.warn('Failed to cleanup container files:', err.message);
    });
    log.info('Container files cleaned up');

    // Check if output file was created
    await fs.access(outputPath);
    log.info('Output file created successfully');

    // Upload restored image to Cloudinary
    log.info('Uploading processed image to Cloudinary...');
    const uploadResult = await cloudinary.uploader.upload(outputPath, {
        folder: 'adobe-ps-uploads',
        resource_type: 'image',
        public_id: `face_restore_${image.publicId}_${Date.now()}`
    });

    // Save restored image to database
    const restoredImage = await Image.create({
        user: req.user._id,
        publicId: uploadResult.public_id,
        imageUrl: uploadResult.secure_url,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
        size: uploadResult.bytes,
        localPath: null
    });

    // Send response first
    res.status(200).json({
        success: true,
        message: 'Face restored successfully',
        data: {
            originalImageId: image._id,
            originalImageUrl: image.imageUrl,
            restoredImageId: restoredImage._id,
            restoredImageUrl: restoredImage.imageUrl,
            publicId: restoredImage.publicId,
            fidelity: fidelity,
            format: restoredImage.format,
            width: restoredImage.width,
            height: restoredImage.height,
            size: restoredImage.size,
            createdAt: restoredImage.createdAt
        }
    });

    // Clean up local files after response is sent (non-blocking)
    res.on('finish', async () => {
        // Delete AI output image
        if (outputPath) {
            await fs.unlink(outputPath).catch(err => {
                log.warn('Failed to delete output image:', err.message);
            });
            log.info('Cleaned up output image:', outputPath);
        }

        // Delete downloaded input file (if it was downloaded from Cloudinary)
        if (downloadedFile && inputPath) {
            await fs.unlink(inputPath).catch(err => {
                log.warn('Failed to delete downloaded input file:', err.message);
            });
            log.info('Cleaned up downloaded input file:', inputPath);
        }
    });
});




// @desc    Enhance(denoise , deblur) image using NafNet
// @route   POST /api/ai/enhance
// @access  Private
export const enhanceImage = catchAsync(async (req, res, next) => {
    const { publicId, mode } = req.body;

    // Validation
    if (!publicId) {
        return next(new AppError('Please provide image public ID', 400));
    }

    if (!mode) {
        return next(new AppError('Please provide mode (denoise or deblur)', 400));
    }

    if (!['denoise', 'deblur'].includes(mode)) {
        return next(new AppError('Mode must be either "denoise" or "deblur"', 400));
    }

    // Find image in database
    const image = await Image.findOne({ publicId });

    if (!image) {
        return next(new AppError('Image not found', 404));
    }

    if (!image.imageUrl) {
        return next(new AppError('Image URL not found. Please re-upload the image.', 404));
    }

    // Download image from Cloudinary to temporary local file
    let inputPath;
    let downloadedFile = false;
    try {
        inputPath = await downloadImageFromCloudinary(image.imageUrl, image._id.toString());
        downloadedFile = true;
    } catch (downloadErr) {
        return next(new AppError(`Failed to download image from Cloudinary: ${downloadErr.message}`, 500));
    }

    // Prepare paths with unique identifiers to avoid conflicts
    const inputFilename = path.basename(inputPath);
    const uniqueId = Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    const outputFilename = `${path.parse(inputPath).name}_${mode}_${uniqueId}.${image.format}`;
    const outputPath = path.join(path.dirname(inputPath), outputFilename);

    // Docker configuration - use persistent container
    const containerName = AI_CONTAINERS.ENHANCE.name;
    const dockerImage = AI_CONTAINERS.ENHANCE.image;

    log.info(`Starting AI ${mode} processing with Docker...`);
    log.info('Input image:', inputPath);
    log.info('Output will be saved to:', outputPath);

    const startTime = Date.now();

    // Ensure container is running
    await ensureContainerRunning(containerName, dockerImage);

    // Copy input image to container
    log.info('Copying image to Docker container...');
    await execAsync(`docker cp "${inputPath}" ${containerName}:/app/demo/${inputFilename}`);
    log.info('Image copied to container');

    // Set PYTHONPATH and run AI model inside container
    log.info(`Running AI model for ${mode} (this may take 30-60 seconds)...`);

    // Choose config file based on mode
    const configFile = mode === 'denoise'
        ? 'options/test/SIDD/NAFNet-width64.yml'
        : 'options/test/REDS/NAFNet-width64.yml';

    const processCommand = `docker exec ${containerName} bash -c "export PYTHONPATH=/app:$PYTHONPATH && python3 basicsr/demo.py -opt ${configFile} --input_path ./demo/${inputFilename} --output_path ./demo/${outputFilename}"`;
    const { stdout, stderr } = await execAsync(processCommand, {
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    });

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log.timing(`[Enhance-${mode}] Processing completed in ${processingTime} seconds`);

    if (stdout) {
        log.info('AI output:', stdout.trim());
    }
    if (stderr) {
        log.warn('AI warnings:', stderr.trim());
    }

    // Copy result back from container
    log.info('Copying result from Docker container...');
    await execAsync(`docker cp ${containerName}:/app/demo/${outputFilename} "${outputPath}"`);
    log.info('Result copied from container');

    // Clean up files inside container to avoid accumulation
    await execAsync(`docker exec ${containerName} rm -f /app/demo/${inputFilename} /app/demo/${outputFilename}`).catch(err => {
        log.warn('Failed to cleanup container files:', err.message);
    });
    log.info('Container files cleaned up');

    // Check if output file was created
    await fs.access(outputPath);
    log.info('Output file created successfully');

    // Upload enhanced image to Cloudinary
    log.info('Uploading processed image to Cloudinary...');
    const uploadResult = await cloudinary.uploader.upload(outputPath, {
        folder: 'adobe-ps-uploads',
        resource_type: 'image',
        public_id: `${mode}_${image.publicId}_${Date.now()}`
    });

    // Save enhanced image to database
    const enhancedImage = await Image.create({
        user: req.user._id,
        publicId: uploadResult.public_id,
        imageUrl: uploadResult.secure_url,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
        size: uploadResult.bytes,
        localPath: null
    });

    // Send response first
    res.status(200).json({
        success: true,
        message: `Image ${mode}d successfully`,
        data: {
            originalImageId: image._id,
            originalImageUrl: image.imageUrl,
            enhancedImageId: enhancedImage._id,
            enhancedImageUrl: enhancedImage.imageUrl,
            publicId: enhancedImage.publicId,
            mode: mode,
            format: enhancedImage.format,
            width: enhancedImage.width,
            height: enhancedImage.height,
            size: enhancedImage.size,
            createdAt: enhancedImage.createdAt
        }
    });

    // Clean up local files after response is sent (non-blocking)
    res.on('finish', async () => {
        // Delete AI output image
        if (outputPath) {
            await fs.unlink(outputPath).catch(err => {
                log.warn('Failed to delete output image:', err.message);
            });
            log.info('Cleaned up output image:', outputPath);
        }

        // Delete downloaded input file (if it was downloaded from Cloudinary)
        if (downloadedFile && inputPath) {
            await fs.unlink(inputPath).catch(err => {
                log.warn('Failed to delete downloaded input file:', err.message);
            });
            log.info('Cleaned up downloaded input file:', inputPath);
        }
    });
});




// @desc    Style transfer using PCA-based model
// @route   POST /api/ai/style-transfer
// @access  Private
export const styleTransfer = catchAsync(async (req, res, next) => {
    const { contentPublicId, stylePublicId, projectId } = req.body;

    // Validate: Must have projectId (for sequential) or contentPublicId (for first operation)
    if (!projectId && !contentPublicId) {
        return next(new AppError('Please provide either projectId (for sequential) or contentPublicId (for first operation)', 400));
    }

    if (!stylePublicId) {
        return next(new AppError('Please provide style image public ID', 400));
    }

    let contentImage;
    let styleImage;

    // CASE 1: Sequential operation - use project's current image as content
    if (projectId && !contentPublicId) {
        const project = await seqAIProject.findOne({ _id: projectId, user: req.user._id });
        
        if (!project) {
            return next(new AppError('layerProject not found', 404));
        }

        if (!project.currentImage || !project.currentImage.publicId) {
            return next(new AppError('No previous image found in project. Please provide contentPublicId for first operation', 400));
        }

        // Use project's current image as content
        contentImage = await Image.findOne({ publicId: project.currentImage.publicId });
        
        if (!contentImage) {
            return next(new AppError('Content image not found in database', 404));
        }

        log.info(`📸 Sequential style transfer: Using project's current image as content (${project.currentImage.publicId})`);
    }
    // CASE 2: First operation or explicit content - use provided contentPublicId
    else {
        contentImage = await Image.findOne({ publicId: contentPublicId });
        
        if (!contentImage) {
            return next(new AppError('Content image not found', 404));
        }

        log.info(`📸 First style transfer: Using provided content image (${contentPublicId})`);
    }

    // Style image is always required
    styleImage = await Image.findOne({ publicId: stylePublicId });
    
    if (!styleImage) {
        return next(new AppError('Style image not found', 404));
    }

    let contentPath = null;
    let stylePath = null;
    let outputPath = null;

    try {
        // Download both images from Cloudinary
        contentPath = await downloadImageFromCloudinary(contentImage.imageUrl);
        stylePath = await downloadImageFromCloudinary(styleImage.imageUrl);

        const contentFilename = path.basename(contentPath);
        const styleFilename = path.basename(stylePath);
        const uniqueId = Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        const outputFilename = `styled_${uniqueId}.jpg`;
        outputPath = path.join(path.dirname(contentPath), outputFilename);

        const containerName = AI_CONTAINERS.STYLE_TRANSFER.name;
        const dockerImage = AI_CONTAINERS.STYLE_TRANSFER.image;

        log.info('Starting style transfer...');
        const startTime = Date.now();

        await ensureContainerRunning(containerName, dockerImage);
        await execAsync(`docker cp "${contentPath}" ${containerName}:/app/figures/content/${contentFilename}`);
        await execAsync(`docker cp "${stylePath}" ${containerName}:/app/figures/style/${styleFilename}`);
        
        const processCommand = `docker exec ${containerName} python demo.py --content figures/content/${contentFilename} --style figures/style/${styleFilename}`;
        await execAsync(processCommand, { maxBuffer: 50 * 1024 * 1024 });
        
        await execAsync(`docker cp ${containerName}:/app/results/output.jpg "${outputPath}"`);
        await execAsync(`docker exec ${containerName} rm -f /app/figures/content/${contentFilename} /app/figures/style/${styleFilename} /app/results/output.jpg`).catch(() => {});

        log.timing(`[StyleTransfer] Completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(outputPath, {
            folder: 'adobe-ps-uploads',
            resource_type: 'image',
            public_id: `style_transfer_${contentImage.publicId}_${Date.now()}`
        });

        const styledImage = await Image.create({
            user: req.user._id,
            publicId: uploadResult.public_id,
            imageUrl: uploadResult.secure_url,
            format: uploadResult.format,
            width: uploadResult.width,
            height: uploadResult.height,
            size: uploadResult.bytes,
            localPath: null
        });

        res.status(200).json({
            success: true,
            message: 'Style transfer completed successfully',
            data: {
                contentImage: {
                    publicId: contentImage.publicId,
                    imageUrl: contentImage.imageUrl
                },
                styleImage: {
                    publicId: styleImage.publicId,
                    imageUrl: styleImage.imageUrl
                },
                outputImage: {
                    publicId: styledImage.publicId,
                    imageUrl: styledImage.imageUrl,
                    width: styledImage.width,
                    height: styledImage.height,
                    format: styledImage.format,
                    size: styledImage.size
                },
                operationType: projectId && !contentPublicId ? 'sequential' : 'first'
            }
        });
    } finally {
        await cleanupTempFile(contentPath);
        await cleanupTempFile(stylePath);
        await cleanupTempFile(outputPath);
    }
});




//@desc remove background from image using AI
//@route POST /api/ai/remove-background
//@access Private
// Supports both direct user calls (defaults to general model) and Gemini calls (with modelType parameter)
export const removeBackground = catchAsync(async (req, res, next) => {
    const { publicId, mode = 'object', modelType } = req.body;

    if (!publicId) {
        return next(new AppError('Please provide image public ID', 400));
    }

    // Support both old 'mode' parameter and new 'modelType' parameter
    // modelType: 'general' (u2net.onnx) or 'human' (u2net_human_seg.onnx)
    // mode: 'object' (general) or 'human' (human-specific) - for backward compatibility
    let selectedModelType = modelType;
    
    // If modelType is not provided, derive from mode for backward compatibility
    if (!selectedModelType) {
        selectedModelType = mode === 'human' ? 'human' : 'general';
    }

    // Validate modelType
    if (!['general', 'human'].includes(selectedModelType)) {
        return next(new AppError('modelType must be either "general" or "human"', 400));
    }

    const image = await Image.findOne({ publicId, user: req.user._id });
    if (!image) {
        return next(new AppError('Image not found or does not belong to you', 404));
    }

    let localPath = null;
    let outputPath = null;

    try {
        // Download image from Cloudinary
        localPath = await downloadImageFromCloudinary(image.imageUrl, image._id.toString());

        const inputFilename = path.basename(localPath);
        const uniqueId = Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        const outputFilename = `nobg_${uniqueId}.png`;
        outputPath = path.join(path.dirname(localPath), outputFilename);

        // Determine which model to use based on modelType
        // general -> u2net.onnx (for all objects including humans)
        // human -> u2net_human_seg.onnx (optimized for human segmentation)
        const modelFile = selectedModelType === 'human' ? 'u2net_human_seg.onnx' : 'u2net.onnx';
        const containerName = AI_CONTAINERS.BACKGROUND_REMOVAL.name;
        const dockerImage = AI_CONTAINERS.BACKGROUND_REMOVAL.image;

        log.info(`Starting background removal with model: ${modelFile} (type: ${selectedModelType})...`);
        const startTime = Date.now();

        // Ensure container is running
        await ensureContainerRunning(containerName, dockerImage);

        // Step 1: Copy image to container's samples directory
        log.info('📤 Copying image to container...');
        await execAsync(`docker cp "${localPath}" ${containerName}:/app/samples/${inputFilename}`);

        // Step 2: Run Python app.py with the appropriate model
        log.info(`🔍 Running background removal with ${modelFile}...`);
        const processCommand = `docker exec ${containerName} python app.py samples/${inputFilename} samples/${outputFilename} models/${modelFile}`;
        const { stdout, stderr } = await execAsync(processCommand, { 
            maxBuffer: 50 * 1024 * 1024 
        });

        if (stdout) {
            log.info('Model output:', stdout.trim());
        }
        if (stderr && !stderr.includes('Saved:') && !stderr.includes('Processing')) {
            log.warn('Model warnings:', stderr.trim());
        }

        // Step 3: Copy output back from container
        log.info('📥 Copying result from container...');
        await execAsync(`docker cp ${containerName}:/app/samples/${outputFilename} "${outputPath}"`);

        // Step 4: Clean up files in container
        await execAsync(`docker exec ${containerName} rm -f /app/samples/${inputFilename} /app/samples/${outputFilename}`).catch(() => {});

        log.timing(`[BackgroundRemoval-${selectedModelType}] Completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

        const stats = await fs.stat(outputPath);
        if (stats.size === 0) {
            return next(new AppError('Background removal produced an empty file', 500));
        }

        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(outputPath, {
            folder: 'adobe-ps-uploads',
            resource_type: 'image',
            public_id: `bg_removed_${image.publicId}_${Date.now()}`
        });

        const processedImage = await Image.create({
            user: req.user._id,
            publicId: uploadResult.public_id,
            imageUrl: uploadResult.secure_url,
            format: uploadResult.format,
            width: uploadResult.width,
            height: uploadResult.height,
            size: uploadResult.bytes,
            localPath: null
        });

        res.status(200).json({
            success: true,
            message: 'Background removed successfully',
            data: {
                inputImage: {
                    publicId: image.publicId,
                    imageUrl: image.imageUrl
                },
                outputImage: {
                    publicId: processedImage.publicId,
                    imageUrl: processedImage.imageUrl,
                    width: processedImage.width,
                    height: processedImage.height,
                    format: processedImage.format,
                    size: processedImage.size
                },
                modelType: selectedModelType,
                model: modelFile,
                mode: mode // Keep for backward compatibility
            }
        });
    } finally {
        await cleanupTempFile(localPath);
        await cleanupTempFile(outputPath);
    }
});




// @desc    Remove object from image using SAM + LaMa
// @route   POST /api/ai/object-removal
// @access  Private
export const objectRemoval = catchAsync(async (req, res, next) => {
    const { publicId, x, y } = req.body;

    if (!publicId) {
        return next(new AppError('Please provide image public ID', 400));
    }

    if (x === undefined || y === undefined) {
        return next(new AppError('Please provide x and y coordinates of the object', 400));
    }

    if (typeof x !== 'number' || typeof y !== 'number') {
        return next(new AppError('Coordinates must be numbers', 400));
    }

    if (x < 0 || y < 0) {
        return next(new AppError('Coordinates must be positive numbers', 400));
    }

    const image = await Image.findOne({ publicId, user: req.user._id });
    if (!image) {
        return next(new AppError('Image not found or does not belong to you', 404));
    }

    let localPath = null;
    let maskPath = null;
    let dilatedMaskPath = null;
    let outputPath = null;

    try {
        // Download image from Cloudinary
        localPath = await downloadImageFromCloudinary(image.imageUrl);

        const inputFilename = path.basename(localPath);
        const uniqueId = Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        const maskFilename = `mask_${uniqueId}.png`;
        maskPath = path.join(path.dirname(localPath), maskFilename);
        const dilatedMaskFilename = `dilated_mask_${uniqueId}.png`;
        dilatedMaskPath = path.join(path.dirname(localPath), dilatedMaskFilename);
        const outputFilename = `object_removed_${uniqueId}.png`;
        outputPath = path.join(path.dirname(localPath), outputFilename);

        const samContainerName = AI_CONTAINERS.OBJECT_REMOVAL_SAM.name;
        const samDockerImage = AI_CONTAINERS.OBJECT_REMOVAL_SAM.image;
        const lamaContainerName = AI_CONTAINERS.OBJECT_REMOVAL_LAMA.name;
        const lamaDockerImage = AI_CONTAINERS.OBJECT_REMOVAL_LAMA.image;

        log.info(`Starting object removal at (${x}, ${y})...`);
        const startTime = Date.now();

        // STEP 1: Generate mask with SAM
        log.info('Step 1: Generating mask with SAM...');
        await ensureContainerRunning(samContainerName, samDockerImage);
        await execAsync(`docker cp "${localPath}" ${samContainerName}:/app/${inputFilename}`);
        
        const samCommand = `docker exec ${samContainerName} python sam_inference.py --image /app/${inputFilename} --point ${x},${y} --output /app/${maskFilename} --checkpoint sam_vit_b_01ec64.pth`;
        await execAsync(samCommand, { maxBuffer: 50 * 1024 * 1024 });
        
        const dilateCommand = `docker exec ${samContainerName} python dialate.py --mask /app/${maskFilename} --kernel 7 --iter 2 --out /app/${dilatedMaskFilename}`;
        await execAsync(dilateCommand, { maxBuffer: 50 * 1024 * 1024 });
        
        await execAsync(`docker cp ${samContainerName}:/app/${dilatedMaskFilename} "${dilatedMaskPath}"`);
        await execAsync(`docker exec ${samContainerName} rm -f /app/${inputFilename} /app/${maskFilename} /app/${dilatedMaskFilename}`).catch(() => {});

        const samTime = ((Date.now() - startTime) / 1000).toFixed(2);
        log.timing(`[SAM] Completed in ${samTime}s`);

        // STEP 2: Remove object with LaMa
        log.info('Step 2: Removing object with LaMa...');
        const lamaStartTime = Date.now();
        
        await ensureContainerRunning(lamaContainerName, lamaDockerImage);
        await execAsync(`docker cp "${localPath}" ${lamaContainerName}:/app/input/${inputFilename}`);
        await execAsync(`docker cp "${dilatedMaskPath}" ${lamaContainerName}:/app/input/${dilatedMaskFilename}`);
        
        // Run LaMa inpainting with --mask flag (uses mask to inpaint object area)
        // --mask: RGB image + mask image
        // --dilate 15: Dilates the mask by 15 pixels for better edge blending
        const lamaCommand = `docker exec ${lamaContainerName} python simple_infer.py --model /app/models/big-lama --image /app/input/${inputFilename} --mask /app/input/${dilatedMaskFilename} --out /app/output/${outputFilename} --dilate 15`;
        await execAsync(lamaCommand, { maxBuffer: 50 * 1024 * 1024 });
        
        await execAsync(`docker cp ${lamaContainerName}:/app/output/${outputFilename} "${outputPath}"`);
        await execAsync(`docker exec ${lamaContainerName} rm -f /app/input/${inputFilename} /app/input/${dilatedMaskFilename} /app/output/${outputFilename}`).catch(() => {});

        const lamaTime = ((Date.now() - lamaStartTime) / 1000).toFixed(2);
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        log.timing(`[LaMa] Completed in ${lamaTime}s | Total: ${totalTime}s`);

        const stats = await fs.stat(outputPath);
        if (stats.size === 0) {
            return next(new AppError('Object removal produced an empty file', 500));
        }

        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(outputPath, {
            folder: 'adobe-ps-uploads',
            resource_type: 'image',
            public_id: `object_removed_${image.publicId}_${Date.now()}`
        });

        const processedImage = await Image.create({
            user: req.user._id,
            publicId: uploadResult.public_id,
            imageUrl: uploadResult.secure_url,
            format: uploadResult.format,
            width: uploadResult.width,
            height: uploadResult.height,
            size: uploadResult.bytes,
            localPath: null
        });

        res.status(200).json({
            success: true,
            message: 'Object removed successfully',
            data: {
                inputImage: {
                    publicId: image.publicId,
                    imageUrl: image.imageUrl
                },
                outputImage: {
                    publicId: processedImage.publicId,
                    imageUrl: processedImage.imageUrl,
                    width: processedImage.width,
                    height: processedImage.height,
                    format: processedImage.format,
                    size: processedImage.size
                },
                coordinates: { x, y },
                processingTime: {
                    sam: `${samTime}s`,
                    lama: `${lamaTime}s`,
                    total: `${totalTime}s`
                }
            }
        });
    } finally {
        await cleanupTempFile(localPath);
        await cleanupTempFile(maskPath);
        await cleanupTempFile(dilatedMaskPath);
        await cleanupTempFile(outputPath);
    }
});




// @desc    Replace background with harmonization using PCT-Net
// @route   POST /api/ai/replace-background
// @access  Private
export const replaceBackground = catchAsync(async (req, res, next) => {
    const { subjectImageUrl, backgroundImageUrl } = req.body;

    if (!subjectImageUrl || !backgroundImageUrl) {
        return next(new AppError('Please provide both subjectImageUrl and backgroundImageUrl', 400));
    }

    // Validate URLs
    try {
        new URL(subjectImageUrl);
        new URL(backgroundImageUrl);
    } catch (err) {
        return next(new AppError('Invalid image URLs provided', 400));
    }

    let subjectPath = null;
    let backgroundPath = null;
    let compositePath = null;
    let foregroundPath = null;
    let maskPath = null;
    let harmonizedPath = null;

    try {
        const uniqueId = Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        
        // Download both images
        log.info('📥 Downloading subject and background images...');
        subjectPath = await downloadImageFromCloudinary(subjectImageUrl, `subject_${uniqueId}`);
        backgroundPath = await downloadImageFromCloudinary(backgroundImageUrl, `background_${uniqueId}`);

        const totalStartTime = Date.now();

        // ========================================
        // STEP 1: Merge subject with background (composite)
        // ========================================
        log.info('📍 Step 1: Creating composite image (subject + background)...');
        const compositeFilename = `composite_${uniqueId}.jpg`;
        compositePath = path.join(path.dirname(subjectPath), compositeFilename);

        // Use Sharp to composite subject on background
        const sharp = (await import('sharp')).default;
        
        // Resize background to standard size
        const backgroundBuffer = await sharp(backgroundPath)
            .resize(1024, 1024, { fit: 'cover' })
            .toBuffer();
        
        // Resize subject to fit on background
        const subjectBuffer = await sharp(subjectPath)
            .resize(1024, 1024, { fit: 'inside' })
            .toBuffer();

        // Composite subject on background
        await sharp(backgroundBuffer)
            .composite([{ input: subjectBuffer, gravity: 'center' }])
            .jpeg({ quality: 95 })
            .toFile(compositePath);

        log.info('✅ Composite created');

        // ========================================
        // STEP 2: Segment composite to extract foreground (subject) using u2net
        // ========================================
        log.info('📍 Step 2: Segmenting composite to extract foreground...');
        const segmentStartTime = Date.now();

        // Determine model type using Gemini classification
        let modelType = 'general';
        try {
            const geminiApiKey = process.env.GEMINI_API_KEY;
            if (geminiApiKey) {
                const { classifyImage } = await import('../AI/LayerAiGemini.js');
                const imageBytes = await fs.readFile(subjectPath);
                const classification = await classifyImage(geminiApiKey, imageBytes, 'image/jpeg');
                
                if (classification.status === 'success' && classification.image_type === 'human') {
                    modelType = 'human';
                    log.info('✅ Classified as human - using u2net_human_seg.onnx');
                } else {
                    log.info('✅ Classified as object - using u2net.onnx');
                }
            }
        } catch (error) {
            log.warn(`⚠️ Gemini classification failed, using default: general`);
        }

        const modelFile = modelType === 'human' ? 'u2net_human_seg.onnx' : 'u2net.onnx';
        const foregroundFilename = `foreground_${uniqueId}.png`;
        foregroundPath = path.join(path.dirname(compositePath), foregroundFilename);

        const u2netContainerName = AI_CONTAINERS.BACKGROUND_REMOVAL.name;
        const u2netDockerImage = AI_CONTAINERS.BACKGROUND_REMOVAL.image;

        await ensureContainerRunning(u2netContainerName, u2netDockerImage);
        await execAsync(`docker cp "${compositePath}" ${u2netContainerName}:/app/samples/${compositeFilename}`);
        
        log.info(`🔍 Extracting foreground with ${modelFile}...`);
        await execAsync(
            `docker exec ${u2netContainerName} python app.py samples/${compositeFilename} samples/${foregroundFilename} models/${modelFile}`,
            { maxBuffer: 50 * 1024 * 1024 }
        );
        
        await execAsync(`docker cp ${u2netContainerName}:/app/samples/${foregroundFilename} "${foregroundPath}"`);
        await execAsync(`docker exec ${u2netContainerName} rm -f /app/samples/${compositeFilename} /app/samples/${foregroundFilename}`).catch(() => {});

        const segmentTime = ((Date.now() - segmentStartTime) / 1000).toFixed(2);
        log.timing(`[u2net] Segmentation completed in ${segmentTime}s`);

        // ========================================
        // STEP 3: Convert foreground to binary mask
        // ========================================
        log.info('📍 Step 3: Converting foreground to binary mask...');
        const maskFilename = `${path.parse(compositeFilename).name}_mask.png`;
        maskPath = path.join(path.dirname(foregroundPath), maskFilename);

        // Convert RGBA foreground to binary mask (alpha channel -> white/black)
        const foregroundImage = await sharp(foregroundPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const { data, info } = foregroundImage;
        
        // Create binary mask from alpha channel
        const maskData = Buffer.alloc(info.width * info.height);
        for (let i = 0; i < info.width * info.height; i++) {
            const alpha = data[i * 4 + 3]; // Alpha channel
            maskData[i] = alpha > 128 ? 255 : 0; // Binary threshold
        }

        await sharp(maskData, {
            raw: {
                width: info.width,
                height: info.height,
                channels: 1
            }
        })
        .png()
        .toFile(maskPath);

        log.info('✅ Mask created');

        // ========================================
        // STEP 4: Harmonize with PCT-Net
        // ========================================
        log.info('📍 Step 4: Harmonizing composite with PCT-Net...');
        const pctStartTime = Date.now();

        const harmonizedFilename = `harmonized_${uniqueId}.jpg`;
        harmonizedPath = path.join(path.dirname(compositePath), harmonizedFilename);

        const pctContainerName = AI_CONTAINERS.BACKGROUND_HARMONIZATION.name;
        const pctDockerImage = AI_CONTAINERS.BACKGROUND_HARMONIZATION.image;

        await ensureContainerRunning(pctContainerName, pctDockerImage);
        
        // Copy composite and mask to PCT-Net container
        await execAsync(`docker cp "${compositePath}" ${pctContainerName}:/workspace/examples/composites/${compositeFilename}`);
        await execAsync(`docker cp "${maskPath}" ${pctContainerName}:/workspace/examples/composites/${maskFilename}`);

        log.info('🎨 Running PCT-Net harmonization...');
        const pctCommand = `docker exec ${pctContainerName} python3 run_inference.py --image /workspace/examples/composites/${compositeFilename} --mask /workspace/examples/composites/${maskFilename} --weights pretrained_models/PCTNet_ViT.pth --model_type ViT_pct --out /workspace/examples/composites/${harmonizedFilename}`;
        const { stdout, stderr } = await execAsync(pctCommand, { maxBuffer: 50 * 1024 * 1024 });

        if (stdout) log.info('PCT-Net output:', stdout.trim());
        if (stderr) log.warn('PCT-Net warnings:', stderr.trim());

        // Copy harmonized result back
        await execAsync(`docker cp ${pctContainerName}:/workspace/examples/composites/${harmonizedFilename} "${harmonizedPath}"`);
        await execAsync(`docker exec ${pctContainerName} rm -f /workspace/examples/composites/${compositeFilename} /workspace/examples/composites/${maskFilename} /workspace/examples/composites/${harmonizedFilename}`).catch(() => {});

        const pctTime = ((Date.now() - pctStartTime) / 1000).toFixed(2);
        const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(2);
        log.timing(`[PCT-Net] Harmonization completed in ${pctTime}s | Total: ${totalTime}s`);

        // Check output file
        const stats = await fs.stat(harmonizedPath);
        if (stats.size === 0) {
            return next(new AppError('Background replacement produced an empty file', 500));
        }

        // Upload harmonized image to Cloudinary
        log.info('☁️ Uploading harmonized image to Cloudinary...');
        const uploadResult = await cloudinary.uploader.upload(harmonizedPath, {
            folder: 'adobe-ps-uploads',
            resource_type: 'image',
            public_id: `bg_replaced_${uniqueId}`
        });

        const harmonizedImage = await Image.create({
            user: req.user._id,
            publicId: uploadResult.public_id,
            imageUrl: uploadResult.secure_url,
            format: uploadResult.format,
            width: uploadResult.width,
            height: uploadResult.height,
            size: uploadResult.bytes,
            localPath: null
        });

        res.status(200).json({
            success: true,
            message: 'Background replaced and harmonized successfully',
            data: {
                subjectImageUrl: subjectImageUrl,
                backgroundImageUrl: backgroundImageUrl,
                outputImage: {
                    publicId: harmonizedImage.publicId,
                    imageUrl: harmonizedImage.imageUrl,
                    width: harmonizedImage.width,
                    height: harmonizedImage.height,
                    format: harmonizedImage.format,
                    size: harmonizedImage.size
                },
                modelType: modelType,
                processingTime: {
                    segmentation: `${segmentTime}s`,
                    harmonization: `${pctTime}s`,
                    total: `${totalTime}s`
                }
            }
        });

    } finally {
        await cleanupTempFile(subjectPath);
        await cleanupTempFile(backgroundPath);
        await cleanupTempFile(compositePath);
        await cleanupTempFile(foregroundPath);
        await cleanupTempFile(maskPath);
        await cleanupTempFile(harmonizedPath);
    }
});