
import { GoogleGenAI, Type } from "@google/genai";
import { firebaseConfig } from "../firebase/config.ts";

// Do not initialize at the top level to prevent an app crash if the API_KEY is missing.
let ai: GoogleGenAI | null = null;
const MANUAL_KEY_STORAGE_KEY = 'gemini_manual_api_key';

export const setManualApiKey = (key: string) => {
    if (key && key.trim().length > 0) {
        try {
            localStorage.setItem(MANUAL_KEY_STORAGE_KEY, key.trim());
            // Reset the client so it re-initializes with the new key next time
            ai = null; 
        } catch (e) {
            console.error("Failed to save API key to local storage", e);
        }
    }
};

/**
 * Lazily initializes and returns the GoogleGenAI client.
 * Throws an error if the API key is not available in the environment.
 */
const getAiClient = (): GoogleGenAI => {
    // Support multiple ways to inject the key for different build environments
    // Priority:
    // 1. Manually entered key (localStorage) - Fixes deployment issues without rebuilding
    // 2. process.env.API_KEY (Sandbox / Standard Node / Webpack DefinePlugin)
    // 3. import.meta.env.VITE_API_KEY (Vite standard)
    // 4. process.env.REACT_APP_API_KEY (Create React App standard)
    // 5. firebaseConfig.apiKey (Fallback)
    
    let apiKey: string | undefined;

    // 1. Check Local Storage (Manual Override)
    try {
        const manualKey = localStorage.getItem(MANUAL_KEY_STORAGE_KEY);
        if (manualKey) apiKey = manualKey;
    } catch (e) {
        // Ignore local storage errors
    }

    // 2. Check for Vite environment variable
    if (!apiKey) {
        try {
            // @ts-ignore
            if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
                // @ts-ignore
                apiKey = import.meta.env.VITE_API_KEY;
            }
        } catch (e) {
            // Ignore errors if import.meta is not supported
        }
    }

    // 3. Check for React App environment variable (Process env)
    if (!apiKey && typeof process !== 'undefined' && process.env) {
        if (process.env.API_KEY) apiKey = process.env.API_KEY;
        else if (process.env.REACT_APP_API_KEY) apiKey = process.env.REACT_APP_API_KEY;
    }

    // Filter out placeholder strings that might get injected by build tools
    if (apiKey === 'undefined' || apiKey === 'null' || apiKey === '') {
        apiKey = undefined;
    }

    // 4. Fallback: Use the Firebase API key if no specific Gemini key is found.
    // This works if the Firebase API Key has the "Generative Language API" enabled in Google Cloud Console.
    if (!apiKey && firebaseConfig && firebaseConfig.apiKey) {
        apiKey = firebaseConfig.apiKey;
        // console.log("Using Firebase API Key for Gemini Service.");
    }

    if (!apiKey) {
        // This provides a clear error message when the AI functionality is actually used.
        throw new Error("Gemini API key is not configured. Face verification is disabled.");
    }
    
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: apiKey });
    }
    return ai;
};


const getBase64Data = (dataUrl: string): string => {
    const parts = dataUrl.split(',');
    return parts.length > 1 ? parts[1] : dataUrl;
};

const fileToGenerativePart = (base64Data: string, mimeType: string) => {
    return {
        inlineData: {
            data: base64Data,
            mimeType,
        },
    };
};

export const verifyFace = async (registeredFaceBase64: string, verificationFaceBase64: string): Promise<{ match: boolean; confidence: number }> => {
    try {
        const genAI = getAiClient(); // Initialize client on first use.

        const registeredFaceData = getBase64Data(registeredFaceBase64);
        const verificationFaceData = getBase64Data(verificationFaceBase64);

        const registeredFacePart = fileToGenerativePart(registeredFaceData, 'image/jpeg');
        const verificationFacePart = fileToGenerativePart(verificationFaceData, 'image/jpeg');

        // A more direct prompt that sets a clear role and instructions for the AI.
        const prompt = `You are a highly accurate AI facial recognition system.
The first image is the student's official profile image from their record.
The second image is a live photo just taken for attendance verification.

Your task is to determine if the person in the live photo is the same person as in the profile image. Be resilient to minor changes in lighting, angle, and facial expression.
Your output must be a JSON object.`;

        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            // A cleaner content structure: images first, then the prompt.
            contents: { parts: [
                registeredFacePart,
                verificationFacePart,
                { text: prompt }
            ]},
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        match: {
                            type: Type.BOOLEAN,
                            description: "True if the faces are a match, false otherwise."
                        },
                        confidence: {
                            type: Type.NUMBER,
                            description: "A confidence score between 0.0 and 1.0 indicating the certainty of the match decision."
                        }
                    },
                    required: ["match", "confidence"]
                }
            }
        });
        
        let jsonString = response.text.trim();
        
        // Clean potential markdown fences from the response
        if (jsonString.startsWith('```json')) {
            jsonString = jsonString.substring(7);
        } else if (jsonString.startsWith('```')) {
            jsonString = jsonString.substring(3);
        }
        
        if (jsonString.endsWith('```')) {
            jsonString = jsonString.slice(0, -3);
        }
        jsonString = jsonString.trim();
        
        const result = JSON.parse(jsonString);

        if (typeof result.match === 'boolean' && typeof result.confidence === 'number') {
            return {
                match: result.match,
                confidence: result.confidence
            };
        } else {
            throw new Error("Invalid JSON structure in Gemini response.");
        }

    } catch (error: any) {
        console.error("Error verifying face with Gemini:", error);
        
        // Parse detailed API errors if possible
        let errorMessage = "An unknown error occurred during face verification.";
        
        if (error instanceof Error) {
            errorMessage = error.message;
            
            // Attempt to extract a cleaner message from JSON error strings (common with Google APIs)
            if (errorMessage.includes('{') && errorMessage.includes('error')) {
                try {
                    // Try to find the JSON part of the error message
                    const jsonStart = errorMessage.indexOf('{');
                    const jsonEnd = errorMessage.lastIndexOf('}') + 1;
                    const jsonStr = errorMessage.substring(jsonStart, jsonEnd);
                    const errorObj = JSON.parse(jsonStr);
                    
                    if (errorObj.error && errorObj.error.message) {
                        errorMessage = `AI Service Error: ${errorObj.error.message}`;
                    }
                } catch (e) {
                    // Fallback to original message if parsing fails
                }
            }
        }
        
        throw new Error(errorMessage);
    }
};
