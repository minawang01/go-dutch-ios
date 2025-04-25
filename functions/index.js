/**
 * Firebase Cloud Functions
 * 
 * This is the main entry point for all Firebase functions.
 * Individual functions are modularized in separate files.
 */

// const logger = require("firebase-functions/logger");

// Import modularized functions
import { processReceipt } from './src/processReceipt.js';
import { saveReceipt } from './src/saveReceipt.js';
import { loadReceiptById } from './src/loadReceiptById.js';
import { updateReceiptById } from './src/updateReceiptById.js';

// Export functions
export { processReceipt, saveReceipt, loadReceiptById, updateReceiptById }; 