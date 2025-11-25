
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ImageAspectRatio, ImageSize } from '../types';

// Ensure API Key is available
const apiKey = process.env.API_KEY || '';

// Singleton instance getter
const getAI = () => new GoogleGenAI({ apiKey });

// Retry utility for 503/Unavailable errors
async function retryOperation<T>(operation: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check for 503, 504, or specific timeout messages
      const isRetryable = 
        error?.status === 503 || 
        error?.status === 504 || 
        error?.code === 503 ||
        (error?.message && (error.message.includes('UNAVAILABLE') || error.message.includes('timeout') || error.message.includes('Overloaded')));

      if (!isRetryable) {
        throw error;
      }

      // Wait with exponential backoff
      const delay = initialDelay * Math.pow(2, i);
      console.warn(`API attempt ${i + 1} failed (503/Timeout). Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// --- 1. General Chat (Gemini 3 Pro) ---
export const sendChatMessage = async (history: {role: string, parts: {text: string}[]}[], message: string) => {
  const ai = getAI();
  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    history: history,
    config: {
      systemInstruction: "You are Structura, an expert AI construction estimator. You specialize in analyzing blueprints, estimating materials, and providing code-compliant advice. Your tone is professional, technical, and concise."
    }
  });

  const response = await retryOperation<GenerateContentResponse>(() => chat.sendMessage({ message }));
  return response.text;
};

// --- 2. Plan Takeoff (Gemini 3 Pro - Multimodal) ---
export const analyzePlan = async (base64Data: string, mimeType: string, selectedScopes: string[] = []) => {
  const ai = getAI();
  
  const scopeInstruction = selectedScopes.length > 0 
    ? `Strictly limit the takeoff to the following CSI Divisions/Scopes: ${selectedScopes.join(', ')}. Do not list items from other trades/divisions.` 
    : 'Identify all distinct construction elements across all standard CSI divisions.';

  const prompt = `
    Analyze this construction plan/blueprint. Perform a comprehensive material takeoff.
    
    ${scopeInstruction}
    
    For each element, determine:
    1. A clear technical description (e.g., "Interior 2x4 Partition Wall", "Exterior Door 3068", "Roofing Shingles").
    2. The Quantity (count, length, or area).
    3. The Unit (ea, lf, sf, sq).
    4. The Category (Use standard CSI MasterFormat Division names, e.g., "09 - Finishes").
    5. An estimated complexity factor (Low, Medium, High) in notes.

    Return a flat list of items.
  `;

  const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "Executive summary of the scope." },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unit: { type: Type.STRING },
                category: { type: Type.STRING },
                notes: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  }));
  
  return JSON.parse(response.text || '{}');
};

// --- 3. Complex Estimation (Thinking Mode - Gemini 3 Pro) ---
export const generateComplexEstimate = async (projectDetails: string) => {
  const ai = getAI();
  const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: projectDetails,
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
    }
  }));
  return response.text;
};

// --- 4. Material Pricing (Search Grounding - Gemini 2.5 Flash) ---
export const getMaterialPricing = async (materialList: string) => {
  const ai = getAI();
  const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Find current average 2024-2025 market prices for these construction materials in the US: ${materialList}. List specific product prices found.`,
    config: {
      tools: [{ googleSearch: {} }]
    }
  }));

  return {
    text: response.text,
    groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
  };
};

// --- 5. Find Suppliers (Maps Grounding - Gemini 2.5 Flash) ---
export const findLocalSuppliers = async (query: string, lat: number, lng: number) => {
  const ai = getAI();
  const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Find local suppliers for: ${query}. Provide their names, ratings, and address.`,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: lat,
            longitude: lng
          }
        }
      }
    }
  }));

  return {
    text: response.text,
    groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
  };
};

// --- 6. Quick Calc (Gemini 2.5 Flash Lite) ---
export const quickCalculate = async (expression: string) => {
  const ai = getAI();
  const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-lite-latest',
    contents: `Solve this construction math problem quickly. Return the result, then a new line, then a 1 sentence explanation. Problem: ${expression}`
  }));
  return response.text;
};

// --- 7. Image Generation (Gemini 3 Pro Image) ---
export const generateConceptImage = async (prompt: string, aspectRatio: ImageAspectRatio, size: ImageSize) => {
  const ai = getAI();
  
  const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      // @ts-ignore
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: size
      }
    }
  }));

  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }
  return null;
};

// --- 8. Image Editing (Gemini 2.5 Flash Image) ---
export const editPlanImage = async (base64Image: string, mimeType: string, prompt: string) => {
  const ai = getAI();
  const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Image } },
        { text: prompt }
      ]
    }
  }));

  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }
  return null;
};

// --- 9. Video Understanding (Gemini 3 Pro) ---
export const analyzeSiteVideo = async (base64Video: string, mimeType: string, prompt: string) => {
  const ai = getAI();
  const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Video } },
        { text: prompt }
      ]
    }
  }));
  return response.text;
};

// --- 10. Check Key Selection ---
export const ensureApiKey = async () => {
    // @ts-ignore
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
         // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
             // @ts-ignore
            await window.aistudio.openSelectKey();
        }
    }
}
