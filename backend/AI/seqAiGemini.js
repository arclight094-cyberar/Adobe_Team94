import { GoogleGenerativeAI } from "@google/generative-ai";

// ----------------------------
// CONFIG
// ----------------------------
const SUPPORTED_FEATURES = {
    object_removal: {
        requires_mask: true,
        description: "Remove unwanted objects using LaMa inpainting."
    },
    background_removal: {
        requires_mask: false,
        description: "Remove background using U2Net segmentation."
    },
    face_restoration: {
        requires_mask: false,
        description: "Restore degraded faces using CodeFormer."
    },
    denoise: {
        requires_mask: false,
        description: "Remove noise from image using NAFNet."
    },
    deblur: {
        requires_mask: false,
        description: "Remove blur from image using NAFNet."
    },
    low_light_enhancement: {
        requires_mask: false,
        description: "Enhance dark/underexposed images using LytNet."
    }
};

const API_SYSTEM_PROMPT = `
You are an image editing assistant. Only use supported features provided.

If unsupported, say so and list available features.

Return JSON with: feature, requires_mask, message, supported.
`;

// ----------------------------
// CONFIGURE GEMINI MODEL
// ----------------------------
function configureGemini(apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        systemInstruction: API_SYSTEM_PROMPT
    });
}

// ----------------------------
// DETECT SUBJECT TYPE
// ----------------------------
async function detectSubjectType(model, imageBytes, mimeType = "image/jpeg") {
    const prompt = `
Is the main subject in this image a human or an object?

Return ONLY one word: "human" or "object"
`;

    try {
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mimeType,
                    data: imageBytes.toString("base64")
                }
            }
        ]);

        const responseText = result.response.text().trim().toLowerCase();
        
        // Extract "human" or "object" from response
        if (responseText.includes("human")) {
            return "human";
        } else if (responseText.includes("object")) {
            return "object";
        }
        
        // Default to object if unclear
        return "object";
    } catch (error) {
        console.error("Error detecting subject type:", error);
        return "object"; // Default fallback
    }
}

// ----------------------------
// SUGGEST EDITS
// ----------------------------
async function suggestEdits(model, imageBytes, mimeType = "image/jpeg") {
    const prompt = `
Analyze image. Suggest 3-5 edits from ONLY these features:
object_removal, background_removal, face_restoration, denoise, deblur, low_light_enhancement.

Return plain text list.
`;

    try {
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mimeType,
                    data: imageBytes.toString("base64")
                }
            }
        ]);

        const suggestionsText = result.response.text().trim();
        const suggestions = suggestionsText.split("\n").filter(line => line.trim());

        return {
            mode: "suggestions",
            suggestions: suggestions
        };
    } catch (error) {
        return {
            mode: "suggestions",
            status: "error",
            message: error.message,
            suggestions: []
        };
    }
}

// ----------------------------
// ANALYZE USER PROMPT
// ----------------------------
async function analyzeUserPrompt(model, userText, imageBytes = null, mimeType = "image/jpeg") {
    const featureList = Object.keys(SUPPORTED_FEATURES).join(", ");
    
    const prompt = `
User: "${userText}"

Map to ONE feature from: ${featureList}

If no match, return "not_supported".

Return JSON: {"feature": "...", "requires_mask": bool, "message": "...", "supported": bool}
`;

    try {
        const content = [prompt];
        if (imageBytes) {
            content.push({
                inlineData: {
                    mimeType: mimeType,
                    data: imageBytes.toString("base64")
                }
            });
        }

        const result = await model.generateContent(content);
        const responseText = result.response.text().trim();

        // Clean response - remove markdown code blocks if present
        let cleanedText = responseText;
        if (cleanedText.startsWith("```json")) {
            cleanedText = cleanedText.substring(7);
        }
        if (cleanedText.startsWith("```")) {
            cleanedText = cleanedText.substring(3);
        }
        if (cleanedText.endsWith("```")) {
            cleanedText = cleanedText.substring(0, cleanedText.length - 3);
        }

        const parsedResult = JSON.parse(cleanedText.trim());
        
        // Ensure supported field exists
        if (parsedResult.supported === undefined) {
            parsedResult.supported = parsedResult.feature !== "not_supported" && parsedResult.feature !== null;
        }

        return parsedResult;
    } catch (error) {
        if (error instanceof SyntaxError) {
            return {
                status: "error",
                message: "Failed to parse AI response",
                supported: false
            };
        }
        return {
            status: "error",
            message: error.message,
            supported: false
        };
    }
}

// ----------------------------
// MAIN ROUTER
// ----------------------------
async function route(apiKey, {
    imageBytes = null,
    userText = null,
    mimeType = "image/jpeg"
} = {}) {
    /**
     * Main routing function for the image editing assistant.
     * 
     * @param {string} apiKey - Gemini API key
     * @param {object} options - Options object
     * @param {Buffer} options.imageBytes - Image bytes
     * @param {string} options.userText - User's text prompt
     * @param {string} options.mimeType - Image MIME type
     * @returns {object} Response object
     */

    const model = configureGemini(apiKey);

    // Case 1: Image uploaded, no text → Auto suggestions
    if (imageBytes && !userText) {
        return await suggestEdits(model, imageBytes, mimeType);
    }

    // Case 2: User text provided → Analyze intent
    if (userText) {
        const result = await analyzeUserPrompt(model, userText, imageBytes, mimeType);

        // Check subject type for background removal
        if (imageBytes && result.feature === "background_removal") {
            const subjectType = await detectSubjectType(model, imageBytes, mimeType);
            
            // Append subject type to response
            return {
                ...result,
                subject_type: subjectType,
                model: subjectType === "human" ? "u2net_human_seg" : "u2net"
            };
        }

        return result;
    }

    // Case 3: No valid input
    return {
        status: "error",
        message: "No input provided."
    };
}

// ----------------------------
// UTILITY FUNCTIONS
// ----------------------------
function getSupportedFeatures() {
    return {
        status: "success",
        features: SUPPORTED_FEATURES,
        feature_list: Object.keys(SUPPORTED_FEATURES)
    };
}

function validateFeature(featureName) {
    return featureName in SUPPORTED_FEATURES;
}

// ----------------------------
// EXPORTS
// ----------------------------
export {
    route,
    configureGemini,
    detectSubjectType,
    analyzeUserPrompt,
    suggestEdits,
    getSupportedFeatures,
    validateFeature,
    SUPPORTED_FEATURES,
    API_SYSTEM_PROMPT
};
