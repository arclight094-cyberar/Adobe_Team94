import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import Image from '../models/Image.js';
import seqAIProject from '../models/AIProject.js';
import { route as geminiRoute } from '../AI/seqAiGemini.js';
import { route as layerGeminiRoute } from '../AI/LayerAiGemini.js';
import { relightImage, enhanceImage, faceRestore, removeBackground, separateLayersInternal } from './aiOperationsController.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import axios from 'axios';






const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temporary directory for downloaded images (shared with aiOperationsController)
const tempImageDir = path.join(__dirname, '..', 'image', 'temp');
fs.mkdir(tempImageDir, { recursive: true }).catch(console.error);

// Helper function for logging (always enabled for debugging)
const log = {
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
    timing: (...args) => console.log(...args)
};




// Helper function to download image from Cloudinary to temporary local file
async function downloadImageFromCloudinary(imageUrl) {
    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const filename = `gemini_temp_${uniqueId}${ext}`;
    const localPath = path.join(tempImageDir, filename);

    log.info(`📥 Downloading image from Cloudinary: ${imageUrl}`);

    try {
        const response = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'stream'
        });

        const writer = fsSync.createWriteStream(localPath);
        await pipeline(response.data, writer);

        log.info(`✅ Image downloaded successfully: ${localPath}`);
        return localPath;
    } catch (error) {
        log.error(`❌ Download failed: ${error.message}`);
        throw new Error(`Failed to download image: ${error.message}`);
    }
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





// @desc    Analyze image and get AI editing suggestions using Gemini
// @route   POST /api/v1/adobe-ps/gemini/analyze
// @access  Private
export const analyzeImage = catchAsync(async (req, res, next) => {
    const { publicId } = req.body;

    // Validation
    if (!publicId) {
        return next(new AppError('Please provide image public ID', 400));
    }

    // Find image in database
    const image = await Image.findOne({ publicId });

    if (!image) {
        return next(new AppError('Image not found', 404));
    }

    if (!image.imageUrl) {
        return next(new AppError('Image URL not found. Please re-upload the image.', 404));
    }

    log.info('Starting image analysis with Gemini AI...');

    // Download image from Cloudinary to temporary local file
    let localPath = null;
    
    try {
        localPath = await downloadImageFromCloudinary(image.imageUrl);

        // Read downloaded image file
        const imageBuffer = await fs.readFile(localPath);

        // Get Gemini API key from environment
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            return next(new AppError('Gemini API key not configured', 500));
        }

        // Analyze image using Gemini
        const analysis = await geminiRoute(geminiApiKey, {
            imageBytes: imageBuffer,
            userText: null
        });

        log.timing('[Gemini] Image analysis completed');

        // Send response
        res.status(200).json({
            success: true,
            message: 'Image analyzed successfully',
            data: {
                imageId: image._id,
                imageUrl: image.imageUrl,
                publicId: image.publicId,
                analysis: analysis
            }
        });
    } finally {
        // Always cleanup temp file
        await cleanupTempFile(localPath);
    }
});







// @desc    Process user text prompt with Gemini and automatically execute the action
// @route   POST /api/v1/adobe-ps/gemini/prompt
// @access  Private
export const processPrompt = catchAsync(async (req, res, next) => {
    const { publicId, prompt, projectId, projectType } = req.body;

    // Validation
    if (!publicId) {
        return next(new AppError('Please provide image public ID', 400));
    }

    if (!prompt) {
        return next(new AppError('Please provide a text prompt', 400));
    }

    // Find image in database
    log.info(`🔍 Looking for image with publicId: ${publicId}`);
    const image = await Image.findOne({ publicId });

    if (!image) {
        log.error(`❌ Image not found with publicId: ${publicId}`);
        // Try to find any recent images for debugging
        const recentImages = await Image.find({}).sort({ createdAt: -1 }).limit(5).select('publicId imageUrl createdAt');
        log.info('📋 Recent images in database:', JSON.stringify(recentImages, null, 2));
        return next(new AppError(`Image not found with publicId: ${publicId}. Please make sure the image exists.`, 404));
    }

    if (!image.imageUrl) {
        log.error(`❌ Image found but imageUrl is missing for publicId: ${publicId}`);
        return next(new AppError('Image URL not found. Please re-upload the image.', 404));
    }

    log.info(`✅ Image found: ${image.imageUrl}`);

    // Validate project if projectType is ai-sequential
    let project = null;
    if (projectType === 'ai-sequential') {
        if (!projectId) {
            return next(new AppError('projectId is required for sequential AI projects', 400));
        }

        project = await seqAIProject.findOne({ _id: projectId, user: req.user._id });
        if (!project) {
            return next(new AppError('AI Sequential project not found', 404));
        }
    }

    log.info('Processing user prompt with Gemini AI...');

    // Download image from Cloudinary to temporary local file
    let localPath = null;
    
    try {
        localPath = await downloadImageFromCloudinary(image.imageUrl);

        // Read downloaded image file
        const imageBuffer = await fs.readFile(localPath);

        // Get Gemini API key
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            return next(new AppError('Gemini API key not configured', 500));
        }

        // Analyze prompt with image using Gemini
        const intentAnalysis = await geminiRoute(geminiApiKey, {
            imageBytes: imageBuffer,
            userText: prompt
        });

        // Parse JSON response
        let parsedIntent;
        try {
            // Check if intentAnalysis is already an object (parsed JSON)
            if (typeof intentAnalysis === 'object' && intentAnalysis !== null) {
                parsedIntent = intentAnalysis;
            } else if (typeof intentAnalysis === 'string') {
                // Remove markdown code blocks if present
                const cleanJson = intentAnalysis.replace(/```json\n?|```\n?/g, '').trim();
                parsedIntent = JSON.parse(cleanJson);
            } else {
                throw new Error('Unexpected response type from Gemini');
            }
        } catch (err) {
            log.error('Failed to parse Gemini response:', err);
            log.error('Intent analysis type:', typeof intentAnalysis);
            log.error('Intent analysis value:', intentAnalysis);
            return next(new AppError('Failed to analyze prompt. Please try again.', 500));
        }

        log.timing('[Gemini] Prompt analysis completed');

        // Check for API errors FIRST (before checking if supported)
        // This handles quota/rate limit errors and other API errors
        const errorMessage = parsedIntent.message || '';
        const isApiError = parsedIntent.status === 'error' || 
                          errorMessage.includes('GoogleGenerativeAI Error') ||
                          errorMessage.includes('Error fetching from') ||
                          errorMessage.includes('429') ||
                          errorMessage.includes('quota') ||
                          errorMessage.includes('Quota exceeded') ||
                          errorMessage.includes('rate limit') ||
                          errorMessage.includes('Too Many Requests');

        if (isApiError) {
            // Check for quota/rate limit errors (429 status code)
            if (errorMessage.includes('429') || 
                errorMessage.includes('quota') || 
                errorMessage.includes('Quota exceeded') ||
                errorMessage.includes('rate limit') ||
                errorMessage.includes('Too Many Requests') ||
                errorMessage.includes('free_tier') ||
                errorMessage.includes('free_tier_requests')) {
                return next(new AppError(
                    'Gemini API quota exceeded. Please wait a few minutes and try again, or check your API billing plan. If you\'re on the free tier, you may have reached the daily limit.',
                    429
                ));
            }
            
            // Other API errors
            log.error('Gemini API error:', errorMessage);
            return next(new AppError(
                `Gemini API error: ${errorMessage.substring(0, 200)}${errorMessage.length > 200 ? '...' : ''}`,
                500
            ));
        }

        // Check if feature is supported
        if (!parsedIntent.supported) {
            return res.status(200).json({
                success: false,
                message: parsedIntent.message,
                data: {
                    userPrompt: prompt,
                    supported: false,
                    availableFeatures: ['relight', 'denoise', 'deblur', 'face-restore', 'style-transfer', 'remove-background', 'layer-separation', 'object-removal']
                }
            });
        }

        // Execute the appropriate action based on Gemini's analysis
        log.info(`Executing action: ${parsedIntent.feature}`);

        // Cleanup temp file before executing action
        await cleanupTempFile(localPath);
        localPath = null; // Prevent double cleanup

        // Set up req.body for AI operation
        const operationParams = { publicId };
        
        // Add projectId if sequential
        if (projectType === 'ai-sequential' && projectId) {
            operationParams.projectId = projectId;
        }

        // Create custom response handler to capture output and add to history
        const originalJson = res.json.bind(res);
        res.json = async function(data) {
            // Add to history if sequential and operation succeeded
            if (projectType === 'ai-sequential' && data?.success && data?.data) {
                // Map features to operation types
                const operationTypeMap = {
                    'relighting': 'relight',
                    'low_light_enhancement': 'relight',
                    'auto_enhance': 'enhance',
                    'denoise': 'enhance',
                    'deblur': 'enhance',
                    'face_restore': 'face-restore',
                    'face_restoration': 'face-restore',
                    'background_removal': 'remove-background'
                };

                const operationType = operationTypeMap[parsedIntent.feature];

                if (operationType && data.data.outputImage) {
                    await addOperationToHistory(
                        project,
                        operationType,
                        data.data.prompt || { userPrompt: prompt, feature: parsedIntent.feature },
                        data.data.inputImage,
                        data.data.outputImage
                    );
                }
            }
            
            return originalJson(data);
        };

        switch (parsedIntent.feature) {
            case 'relighting':
            case 'low_light_enhancement':
                req.body = { ...operationParams, brightness: 0.5 };
                await relightImage(req, res, next);
                return;

            case 'auto_enhance':
            case 'denoise':
            case 'deblur':
                const mode = parsedIntent.feature === 'deblur' || parsedIntent.message?.toLowerCase().includes('blur') ? 'deblur' : 'denoise';
                req.body = { ...operationParams, mode };
                await enhanceImage(req, res, next);
                return;

            case 'face_restore':
            case 'face_restoration':
                req.body = { ...operationParams, fidelity: 0.7 };
                await faceRestore(req, res, next);
                return;

            case 'style_transfer':
                // Style transfer requires special handling and is not supported via Gemini prompt
                return next(new AppError('Style transfer via Gemini prompt is not supported. Please use the direct Feature.', 501));

            case 'background_removal':
                // Determine model type: Gemini analyzes the image and determines subject_type
                // New format: subject_type ("human" or "object") and model ("u2net_human_seg" or "u2net")
                let modelType = 'general';
                if (parsedIntent.subject_type === 'human' || parsedIntent.model === 'u2net_human_seg') {
                    modelType = 'human';
                } else if (parsedIntent.model_type) {
                    // Fallback to old format if present
                    modelType = parsedIntent.model_type;
                }
                req.body = { ...operationParams, modelType: modelType, mode: modelType === 'human' ? 'human' : 'object' };
                await removeBackground(req, res, next);
                return;

            case 'layer_separation':
                // Layer separation: Uses LayerAiGemini for classification and enhancement analysis
                // Workflow: LayerAiGemini classifies image → determines model type → u2net extracts foreground → LaMa inpaints background
                // This requires projectId, so check if it's provided
                if (!projectId) {
                    return next(new AppError('Layer separation requires a projectId. Please provide a projectId in the request.', 400));
                }

                try {
                    // Get image URL from the image object
                    const layerImage = await Image.findOne({ publicId, user: req.user._id });
                    if (!layerImage || !layerImage.imageUrl) {
                        return next(new AppError('Image not found or image URL missing', 404));
                    }

                    // Get Gemini API key
                    const geminiApiKey = process.env.GEMINI_API_KEY;
                    if (!geminiApiKey) {
                        return next(new AppError('Gemini API key not configured', 500));
                    }

                    // Use LayerAiGemini for full analysis (classification + enhancement)
                    log.info('🤖 Analyzing image with LayerAiGemini for layer separation...');
                    const analysisResult = await layerGeminiRoute(geminiApiKey, imageBuffer, 'full_analysis');
                    
                    log.info('✅ LayerAiGemini analysis completed:', JSON.stringify(analysisResult, null, 2));

                    // Call separateLayersInternal - it will use the classification result
                    const separationResult = await separateLayersInternal(
                        layerImage.imageUrl,
                        projectId
                    );

                    // Return the separated layers with analysis
                    res.status(200).json({
                        success: true,
                        message: 'Layers separated successfully',
                        data: {
                            userPrompt: prompt,
                            analysis: analysisResult,
                            foreground: separationResult.foreground,
                            background: separationResult.background
                        }
                    });
                } catch (error) {
                    log.error('Error in layer separation:', error);
                    return next(new AppError(`Failed to separate layers: ${error.message}`, 500));
                }
                return;

            case 'object_removal':
                // Object removal detected - guide user to provide coordinates via UI
                res.status(200).json({
                    success: true,
                    requiresInteraction: true,
                    message: 'Object removal detected. Please point out the object on the image that you want to remove.',
                    data: {
                        userPrompt: prompt,
                        feature: 'object_removal',
                        geminiAnalysis: parsedIntent,
                        nextStep: 'Please tap or click on the object in the image to select the area for removal. The coordinates will be used to segment and remove the object.',
                        inputImage: {
                            publicId: image.publicId,
                            imageUrl: image.imageUrl
                        }
                    }
                });
                return;

            default:
                return next(new AppError(`Feature "${parsedIntent.feature}" is recognized but not yet implemented`, 501));
        }
    } catch (error) {
        log.error('Error in prompt processing:', error);
        await cleanupTempFile(localPath);
        return next(new AppError(`Failed to process prompt: ${error.message}`, 500));
    }
});

// Helper function to add operation to AI project history
async function addOperationToHistory(project, operationType, prompt, inputImage, outputImage) {
    if (!project || !outputImage) return;
    
    try {
        await project.addOperation({
            operationType,
            prompt,
            inputImage: {
                imageUrl: inputImage.imageUrl,
                publicId: inputImage.publicId,
                width: inputImage.width,
                height: inputImage.height
            },
            outputImage: {
                imageUrl: outputImage.imageUrl,
                publicId: outputImage.publicId,
                width: outputImage.width,
                height: outputImage.height,
                format: outputImage.format,
                size: outputImage.size
            }
        });
        
        log.info(`✅ Operation ${operationType} added to project history`);
    } catch (err) {
        log.error(`❌ Failed to add operation to history: ${err.message}`);
    }
}

