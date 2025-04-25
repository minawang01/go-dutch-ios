import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import logger from "firebase-functions/logger";

// Initialize Firebase Admin if it hasn't been initialized yet
if (!getApps().length) {
  initializeApp();
}

/**
 * Middleware to verify Firebase Auth token from request header
 * @param {Object} request - The HTTP request object
 * @returns {Promise<string|null>} - Returns the user ID if authenticated, null otherwise
 */
export async function verifyAuthToken(request) {
  const requestId = request.headers['x-request-id'] || Math.random().toString(36).substring(2, 15);
  
  try {
    // Get the Authorization header
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(`Auth [${requestId}]: No valid authorization header`);
      return null;
    }
    
    // Extract the token
    const idToken = authHeader.split('Bearer ')[1];
    
    if (!idToken) {
      logger.warn(`Auth [${requestId}]: Empty token provided`);
      return null;
    }
    
    // Verify the token with Firebase Auth
    const decodedToken = await getAuth().verifyIdToken(idToken);
    
    if (!decodedToken || !decodedToken.uid) {
      logger.warn(`Auth [${requestId}]: Invalid token payload`);
      return null;
    }
    
    logger.info(`Auth [${requestId}]: Successfully authenticated user: ${decodedToken.uid}`);
    return decodedToken.uid;
  } catch (error) {
    logger.error(`Auth [${requestId}]: Token verification failed:`, error);
    return null;
  }
} 