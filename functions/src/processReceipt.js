import { onRequest } from "firebase-functions/v2/https";
import logger from "firebase-functions/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "dotenv";
import { verifyAuthToken } from "../lib/auth.js";
config();

// Get Gemini API key from environment variables or Firebase config
const getGeminiApiKey = () => {
  // First try Firebase config
  try {
    return process.env.GEMINI_API_KEY;
  } catch (e) {
    logger.error("Error getting Gemini API key:", e);
    throw e
  }
};

// The prompt for receipt analysis
const prompt = `The photo provided is a restaurant receipt, please extract the following information:
  - meta info: restaurant name, address, order time, check out time, guest count
  - dishes: number of orders for each dish, price for each dish
  - payment info: subtotal, tax, tip, total, currency

  # Complete text extraction:
  If the receipt is in multiple languages, or in a language other than English, please extract the complete text, not just the English text.
  Also, be careful that some item names may have a number in it, don't confuse it with the number of orders.
  For example, if a dish has 1 order and has a name of "2. 冰沙草莓得其利 Strawberry Daiquiri", then the item's name field should be "2. 冰沙草莓得其利 Strawberry Daiquiri" instead of "Strawberry Daiquiri", and the number of orders should be 1

  # Complex item:
  Some items may have additional charges due to having add-ons, please make sure to identify them as well, include the add-ons in the dish name, and include the add-on charges in the item total field.

  # Missing information:
  Some receipts, especially customer copies, may not have the tip amount or tax amount, or the total amount is handwritten. Please pay attention to the details and don't mix up the information. 
  For example, when customer writes a total amount and skips the tip amount, please don't assume the tip amount is 0 or use the total amount as the tip amount.

  # Currency:
  If possible, deduce the currency of the receipt based on the currency symbol or the country of the restaurant. Use the currency abbreviations, such as USD, EUR, CNY, etc.

  # Output data structure:
  Organize the data in the following json format:
  {
    "meta_data": {
      "restaurant": "string", (if available)
      "address": "string", (if available)
      "ordered_time": "string", (if available)
      "checkout_time": "string", (if available)
      "guest_count": "number" (if available)
    },
    "items": [
      {
        "name": "string",
        "quantity": "number",
        "total": "number"
      },
      {
        "name": "string",
        "quantity": "number",
        "total": "number"
      },
      ....
    ],
    "payment": {
      "subtotal": "number",
      "tax": "number", (if available)
      "tip": "number", (if available)
      "total": "number",
      "currency": "string" (if available)
    }
  }`;

// Process receipt image using Google Gemini
async function processReceiptWithGemini(base64Image, mimeType) {
  try {
    // Initialize Gemini client with API key
    const genAI = new GoogleGenerativeAI(getGeminiApiKey());
    
    // Configuration for the Gemini model
    const generationConfig = {
      temperature: 0,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 4096,
      // responseMimeType: "application/json"
    };
    
    // Create the model with JSON response configuration
    const geminiModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig
    });
    
    // Prepare the image data
    const image = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType,
      },
    };
    
    // Generate content with the image and prompt
    const result = await geminiModel.generateContent([prompt, image]);
    
    // Parse the response
    const responseText = result.response.text();
    
    try {
      // Try parsing the JSON directly
      return JSON.parse(responseText);
    } catch (jsonError) {
      logger.info('Failed direct JSON parsing, trying to extract JSON...');
      
      // If direct parsing fails, try to extract JSON from the text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse JSON from response');
    }
  } catch (error) {
    logger.error('Gemini Error:', error);
    throw error;
  }
}

// Export the processReceipt function
export const processReceipt = onRequest({ 
  cors: true,
  maxInstances: 10,
  timeoutSeconds: 120 // Increased timeout for processing large images
}, async (request, response) => {
  const requestId = request.headers['x-request-id'] || Math.random().toString(36).substring(2, 15);
  
  logger.info(`API [${requestId}]: Receipt processing API called`);
  
  try {
    if (request.method !== 'POST') {
      logger.warn(`API [${requestId}]: Method not allowed: ${request.method}`);
      response.status(405).json({
        error: 'Method not allowed',
        success: false
      });
      return;
    }
    
    // Verify authentication token
    const userId = await verifyAuthToken(request);
    
    if (!userId) {
      logger.error(`API [${requestId}]: Authentication failed`);
      response.status(401).json({
        error: 'Unauthorized: Authentication required',
        success: false
      });
      return;
    }
    
    logger.info(`API [${requestId}]: Authenticated user: ${userId}`);

    // Extract the base64 image from the request body
    const { image: base64Image, type = 'image/jpeg' } = request.body;
    
    if (!base64Image) {
      logger.error(`API [${requestId}]: No image provided`);
      response.status(400).json({ 
        error: "No image provided",
        success: false 
      });
      return;
    }
    
    logger.info(`API [${requestId}]: Processing receipt image`);
    
    // Process the receipt
    const result = await processReceiptWithGemini(base64Image, type);
    
    // Add user ID and success flag to response
    result.userId = userId;
    result.success = true;
    
    logger.info(`API [${requestId}]: Receipt processed successfully`);
    
    // Return the processed data
    response.json(result);
  } catch (error) {
    logger.error(`API [${requestId}]: Error processing receipt:`, error);
    response.status(500).json({ 
      error: error.message || 'Unknown error during receipt processing',
      success: false
    });
  }
}); 