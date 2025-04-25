import { onRequest } from "firebase-functions/v2/https";
import logger from "firebase-functions/logger";
import { updateReceiptById as updateReceipt, getReceiptById } from "../lib/mongodb.js";
import { verifyAuthToken } from "../lib/auth.js";

// Export the updateReceiptById function
export const updateReceiptById = onRequest({ 
  cors: true,
  maxInstances: 10
}, async (request, response) => {
  const requestId = request.headers['x-request-id'] || Math.random().toString(36).substring(2, 15);
  
  logger.info(`API [${requestId}]: Receipt update API called`);
  
  try {
    if (request.method !== 'PUT') {
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
      logger.error(`API [${requestId}]: Missing receipt ID for update`);
      response.status(400).json({ 
        error: 'Receipt ID is required',
        success: false
      });
      return;
    }
    
    logger.info(`API [${requestId}]: Updating receipt with ID: ${id}`);
    
    // Parse the request body
    let updateData;
    try {
      updateData = request.body;
      logger.info(`API [${requestId}]: Update request body parsed successfully`);
    } catch (parseError) {
      logger.error(`API [${requestId}]: Failed to parse request body:`, parseError);
      response.status(400).json({ 
        error: 'Invalid JSON in request body: ' + parseError.message,
        success: false 
      });
      return;
    }
    
    if (!updateData) {
      logger.info(`API [${requestId}]: No update data provided`);
      response.status(400).json({ 
        error: 'Update data is required',
        success: false 
      });
      return;
    }
    
    // First check if the receipt exists
    const existingReceipt = await getReceiptById(id);
    
    if (!existingReceipt) {
      logger.error(`API [${requestId}]: Receipt not found with ID: ${id}`);
      response.status(404).json({ 
        error: 'Receipt not found',
        success: false
      });
      return;
    }
    
    // // We currently allow anyone with the rceiptId to viwe the data
    // if (existingReceipt.processingMetadata && 
    //     existingReceipt.processingMetadata.userId && 
    //     existingReceipt.processingMetadata.userId !== userId) {
    //   logger.error(`API [${requestId}]: User ${userId} not authorized to update receipt ${id}`);
    //   response.status(403).json({ 
    //     error: 'Forbidden: You do not have permission to update this receipt',
    //     success: false
    //   });
    //   return;
    // }
    
    // Ensure processingMetadata.userId is preserved or set if doesn't exist
    if (!updateData.processingMetadata) {
      updateData.processingMetadata = {
        ...(existingReceipt.processingMetadata || {}),
        updatedAt: new Date(),
        userId: updateData.processingMetadata.userId,
        updatedBy: updateData.processingMetadata.updatedBy ? [...updateData.processingMetadata.updatedBy, userId] : [userId]
      };
    } else {
      updateData.processingMetadata = {
        ...updateData.processingMetadata,
        updatedAt: new Date(),
        userId: userId,
        updatedBy: [userId]
      };
    }
    
    // Update the receipt in MongoDB
    logger.info(`API [${requestId}]: Calling updateReceipt`);
    let success;
    try {
      success = await updateReceipt(id, updateData);
      logger.info(`API [${requestId}]: Update result: ${success ? 'success' : 'failed'}`);
    } catch (dbError) {
      logger.error(`API [${requestId}]: MongoDB operation failed:`, dbError);
      response.status(500).json({ 
        error: 'Database operation failed: ' + dbError.message,
        success: false 
      });
      return;
    }
    
    if (!success) {
      logger.info(`API [${requestId}]: Update operation did not succeed`);
      response.status(500).json({ 
        error: 'Failed to update receipt',
        success: false 
      });
      return;
    }
    
    logger.info(`API [${requestId}]: Receipt updated successfully`);
    
    // Return success
    response.json({ 
      id: id,
      success: true 
    });
  } catch (error) {
    logger.error(`API [${requestId}]: Error updating receipt:`, error);
    
    response.status(500).json({
      error: 'Failed to update receipt: ' + error.message,
      success: false
    });
  }
}); 