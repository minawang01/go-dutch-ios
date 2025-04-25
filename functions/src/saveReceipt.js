import { onRequest } from "firebase-functions/v2/https";
import logger from "firebase-functions/logger";
import { createReceiptDocument } from "../lib/mongodb.js";
import { verifyAuthToken } from "../lib/auth.js";

/**
 * Validates that receipt data has the minimum required structure
 * @param {Object} data - The receipt data to validate
 * @returns {boolean} - Whether the data is valid
 */
function validateReceiptData(data) {
  // Require at least one of these data fields to be present
  if (!data.originalData && !data.processedData && !data.shareData) {
    return false;
  }
  
  // If we have processedData, validate its basic structure
  if (data.processedData) {
    const processed = data.processedData;
    if (!processed.items || !Array.isArray(processed.items)) {
      return false;
    }
  }
  
  // If we have shareData, validate its basic structure
  if (data.shareData) {
    const share = data.shareData;
    if (!share.items || !Array.isArray(share.items)) {
      return false;
    }
  }
  
  return true;
}

// Export the saveReceipt function
export const saveReceipt = onRequest({ 
  cors: true,
  maxInstances: 10
}, async (request, response) => {
  const requestId = request.headers['x-request-id'] || Math.random().toString(36).substring(2, 15);
  
  logger.info(`API [${requestId}]: Receipt save API called`);
  
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
    
    // Parse the request body
    let receiptData;
    try {
      receiptData = request.body;
      logger.info(`API [${requestId}]: Request body parsed successfully`);
    } catch (parseError) {
      logger.error(`API [${requestId}]: Failed to parse request body:`, parseError);
      response.status(400).json({ 
        error: 'Invalid JSON in request body: ' + parseError.message,
        success: false 
      });
      return;
    }
    
    if (!receiptData) {
      logger.info(`API [${requestId}]: No receipt data provided`);
      response.status(400).json({ 
        error: 'Receipt data is required',
        success: false 
      });
      return;
    }
    
    // Basic validation of required fields
    if (!validateReceiptData(receiptData)) {
      logger.error(`API [${requestId}]: Invalid receipt data structure`);
      response.status(400).json({ 
        error: 'Invalid receipt data structure. Missing required fields',
        success: false 
      });
      return;
    }
    
    logger.info(`API [${requestId}]: Receipt data received, preparing to save`);
    
    // Add processing metadata if not provided
    if (!receiptData.processingMetadata) {
      receiptData.processingMetadata = {
        processedAt: new Date(),
        source: 'mobile_app',
        userId: userId
      };
    } else {
      // Add userId to existing processingMetadata
      receiptData.processingMetadata.userId = userId;
    }
    
    // Create a document in MongoDB
    logger.info(`API [${requestId}]: Calling createReceiptDocument`);
    let documentId;
    try {
      documentId = await createReceiptDocument(receiptData);
      logger.info(`API [${requestId}]: Document created successfully with ID: ${documentId}`);
    } catch (dbError) {
      logger.error(`API [${requestId}]: MongoDB operation failed:`, dbError);
      response.status(500).json({ 
        error: 'Database operation failed: ' + dbError.message,
        success: false 
      });
      return;
    }
    
    if (!documentId) {
      logger.info(`API [${requestId}]: No document ID returned`);
      response.status(500).json({ 
        error: 'Failed to create receipt document',
        success: false 
      });
      return;
    }
    
    // Track successful document creation (analytics removed as it's not available)
    logger.info(`API [${requestId}]: Document created successfully, skipping analytics`);
    
    logger.info(`API [${requestId}]: Preparing successful response`);
    
    // Return the document ID
    const responseData = { 
      id: documentId,
      success: true 
    };
    
    logger.info(`API [${requestId}]: Sending response:`, responseData);
    response.json(responseData);
  } catch (error) {
    logger.error(`API [${requestId}]: Error saving receipt data:`, error);
    
    response.status(500).json({
      error: 'Failed to save receipt data: ' + error.message,
      success: false
    });
  }
}); 