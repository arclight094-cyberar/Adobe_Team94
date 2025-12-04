import { GoogleGenerativeAI } from "@google/generative-ai";

// ----------------------------
// ENUMS & CONSTANTS
// ----------------------------
const ImageType = {
    HUMAN: "human",
    OBJECT: "object"
};

const EnhancementType = {
    LOW_LIGHT_ENHANCEMENT: "low_light_enhancement",
    DENOISE: "denoise",
    DEBLUR: "deblur",
    FACE_RESTORATION: "face_restoration"
};

const AUTO_ENHANCEMENT_OPTIONS = [
    EnhancementType.LOW_LIGHT_ENHANCEMENT,
    EnhancementType.DENOISE,
    EnhancementType.DEBLUR,
    EnhancementType.FACE_RESTORATION
];

// ----------------------------
// SYSTEM PROMPTS (Concise)
// ----------------------------
const CLASSIFICATION_SYSTEM_PROMPT = `You classify images as "human" or "object". Respond with JSON only.`;

const AUTO_ENHANCE_SYSTEM_PROMPT = `You analyze image quality issues. Respond with JSON only.
DENOISE = grain/noise/artifacts. DEBLUR = blur/softness/focus issues. These are separate.`;

// ----------------------------
// GEMINI CONFIGURATION
// ----------------------------
function configureGemini(apiKey, systemPrompt) {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        systemInstruction: systemPrompt
    });
}

function cleanJsonResponse(responseText) {
    let text = responseText.trim();
    if (text.startsWith("```json")) {
        text = text.substring(7);
    }
    if (text.startsWith("```")) {
        text = text.substring(3);
    }
    if (text.endsWith("```")) {
        text = text.substring(0, text.length - 3);
    }
    return text.trim();
}

// ----------------------------
// IMAGE CLASSIFICATION
// ----------------------------
export async function classifyImage(apiKey, imageBytes, mimeType = "image/jpeg") {
    const model = configureGemini(apiKey, CLASSIFICATION_SYSTEM_PROMPT);
    
    const prompt = `Classify the PRIMARY subject: "human" (people) or "object" (everything else).

Return JSON:
{"status":"success","image_type":"human or object","confidence":"high/medium/low","description":"brief description"}`;

    try {
        const response = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mimeType,
                    data: imageBytes.toString("base64")
                }
            }
        ]);
        
        const result = JSON.parse(cleanJsonResponse(response.response.text()));
        
        if (!["human", "object"].includes(result.image_type)) {
            result.image_type = "object";
        }
        
        return result;
    } catch (error) {
        if (error instanceof SyntaxError) {
            return { 
                status: "error", 
                image_type: "object", 
                confidence: "low", 
                message: "Parse error" 
            };
        }
        return { 
            status: "error", 
            image_type: "object", 
            confidence: "low", 
            message: error.message 
        };
    }
}

// ----------------------------
// AUTO ENHANCEMENT ANALYSIS
// ----------------------------
export async function analyzeForAutoEnhancement(apiKey, imageBytes, mimeType = "image/jpeg") {
    const model = configureGemini(apiKey, AUTO_ENHANCE_SYSTEM_PROMPT);
    
    const prompt = `Analyze image quality. Check independently:
- low_light_enhancement: dark/underexposed?
- denoise: grain/noise/artifacts? (NOT blur)
- deblur: blurry/soft/unfocused? (NOT noise)
- face_restoration: faces need enhancement?

Return JSON:
{"status":"success","needs_enhancement":bool,"enhancements":["only_needed_ones"],"analysis":{"low_light_enhancement":{"needed":bool,"severity":"none/mild/moderate/severe"},"denoise":{"needed":bool,"severity":"..."},"deblur":{"needed":bool,"severity":"..."},"face_restoration":{"needed":bool,"faces_detected":bool,"severity":"..."}},"overall_quality":"good/fair/poor","priority_order":["most_important_first"]}`;

    try {
        const response = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mimeType,
                    data: imageBytes.toString("base64")
                }
            }
        ]);
        
        const result = JSON.parse(cleanJsonResponse(response.response.text()));
        
        if (result.enhancements) {
            result.enhancements = result.enhancements.filter(e => 
                AUTO_ENHANCEMENT_OPTIONS.includes(e)
            );
        }
        
        result.needs_enhancement = (result.enhancements || []).length > 0;
        
        return result;
    } catch (error) {
        if (error instanceof SyntaxError) {
            return { 
                status: "error", 
                needs_enhancement: false, 
                enhancements: [], 
                message: "Parse error" 
            };
        }
        return { 
            status: "error", 
            needs_enhancement: false, 
            enhancements: [], 
            message: error.message 
        };
    }
}

// ----------------------------
// COMBINED ANALYSIS
// ----------------------------
export async function fullImageAnalysis(apiKey, imageBytes, mimeType = "image/jpeg") {
    const classification = await classifyImage(apiKey, imageBytes, mimeType);
    const enhancementAnalysis = await analyzeForAutoEnhancement(apiKey, imageBytes, mimeType);
    
    return {
        status: "success",
        classification,
        enhancement_analysis: enhancementAnalysis
    };
}

// ----------------------------
// MAIN ROUTER
// ----------------------------
export async function route(apiKey, imageBytes, action, mimeType = "image/jpeg") {
    if (!imageBytes) {
        return { status: "error", message: "No image provided" };
    }
    
    if (action === "classify") {
        return await classifyImage(apiKey, imageBytes, mimeType);
    } else if (action === "auto_enhance") {
        return await analyzeForAutoEnhancement(apiKey, imageBytes, mimeType);
    } else if (action === "full_analysis") {
        return await fullImageAnalysis(apiKey, imageBytes, mimeType);
    }
    
    return { status: "error", message: `Unknown action: ${action}` };
}

// ----------------------------
// HELPER FUNCTIONS
// ----------------------------
export function getModelsForImageType(imageType) {
    if (imageType === "human") {
        return {
            image_type: "human",
            recommended_models: {
                segmentation: "human_segmentation_model",
                enhancement: "face_aware_enhancement",
                background_removal: "human_matting_model"
            }
        };
    }
    return {
        image_type: "object",
        recommended_models: {
            segmentation: "general_segmentation_model",
            enhancement: "general_enhancement",
            background_removal: "salient_object_detection"
        }
    };
}

export function getEnhancementPipeline(enhancements) {
    const modelMapping = {
        low_light_enhancement: { model: "low_light_model", order: 1 },
        denoise: { model: "denoise_model", order: 2 },
        deblur: { model: "deblur_model", order: 3 },
        face_restoration: { model: "face_restoration_model", order: 4 }
    };
    
    const pipeline = { steps: [], models: {} };
    
    // Sort enhancements by order
    const sorted = enhancements
        .filter(e => modelMapping[e])
        .sort((a, b) => (modelMapping[a]?.order || 99) - (modelMapping[b]?.order || 99));
    
    for (const e of sorted) {
        pipeline.steps.push(e);
        pipeline.models[e] = modelMapping[e].model;
    }
    
    pipeline.total_steps = pipeline.steps.length;
    return pipeline;
}

// ----------------------------
// EXPORTS
// ----------------------------
export { ImageType, EnhancementType, AUTO_ENHANCEMENT_OPTIONS };
