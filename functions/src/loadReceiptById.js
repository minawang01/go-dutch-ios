import { onRequest } from "firebase-functions/v2/https";
import logger from "firebase-functions/logger";
import { getReceiptById } from "../lib/mongodb.js";
import { verifyAuthToken } from "../lib/auth.js";

// Export the loadReceiptById function
export const loadReceiptById = onRequest({ 
  cors: true,
  maxInstances: 10
}, async (request, response) => {
  const requestId = request.headers['x-request-id'] || Math.random().toString(36).substring(2, 15);
  
  logger.info(`API [${requestId}]: Receipt load API called`);
  
  try {
    if (request.method !== 'GET') {
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
    
    // Get the receipt ID from the URL path
    const id = request.url.split('/').filter(Boolean).pop();
    
    if (!id) {
      logger.error(`API [${requestId}]: Missing receipt ID`);
      response.status(400).json({ 
        error: 'Receipt ID is required',
        success: false
      });
      return;
    }
    
    logger.info(`API [${requestId}]: Loading receipt with ID: ${id}`);
    
    // Get receipt data from MongoDB
    const receiptData = await getReceiptById(id);
    
    if (!receiptData) {
      logger.error(`API [${requestId}]: Receipt not found with ID: ${id}`);
      response.status(404).json({ 
        error: 'Receipt not found',
        success: false
      });
      return;
    }
    
    // // We currently allow anyone with the rceiptId to viwe the data
    // if (receiptData.processingMetadata && 
    //     receiptData.processingMetadata.userId && 
    //     receiptData.processingMetadata.userId !== userId) {
    //   logger.error(`API [${requestId}]: User ${userId} not authorized to access receipt ${id}`);
    //   response.status(403).json({ 
    //     error: 'Forbidden: You do not have permission to access this receipt',
    //     success: false
    //   });
    //   return;
    // }
    
    logger.info(`API [${requestId}]: Successfully loaded receipt with ID: ${id}`);
    
    // Create a clean copy of the receipt data to avoid modifying the original
    const responseData = JSON.parse(JSON.stringify(receiptData));
    
    // Add document ID to relevant data structures
    // Check if we have shareData in the document
    if (responseData.shareData) {
      // Make sure the document ID is included in the shareData
      responseData.shareData.documentId = id;
    }
    
    // Include ID in processedData if it exists
    if (responseData.processedData) {
      responseData.processedData.documentId = id;
    }
    
    // Include the document ID at the top level as well
    responseData.documentId = id;
    
    // Add success flag
    responseData.success = true;
    
    // Log but skip analytics since it's not configured
    logger.info(`API [${requestId}]: Receipt successfully retrieved, skipping analytics`);
    
    // Return the receipt data
    logger.info(`API [${requestId}]: Sending response with receipt data`);
    response.json(responseData);
  } catch (error) {
    logger.error(`API [${requestId}]: Error loading receipt:`, error);
    
    response.status(500).json({
      error: 'Failed to load receipt: ' + error.message,
      success: false
    });
  }
}); 