import { addAuthHeader } from '@/app/services/auth';

// Firebase function endpoints
const PROCESS_RECEIPT_URL = 'https://processreceipt-fiul7uokma-uc.a.run.app';
const SAVE_RECEIPT_URL = 'https://savereceipt-fiul7uokma-uc.a.run.app';
const LOAD_RECEIPT_URL = 'https://loadreceiptbyid-fiul7uokma-uc.a.run.app';
const UPDATE_RECEIPT_URL = 'https://updatereceiptbyid-fiul7uokma-uc.a.run.app';

/**
 * Authenticated fetch that adds authorization headers to requests
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns Promise resolving to the fetch response
 */
export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const authOptions = await addAuthHeader(options);
  return fetch(url, authOptions);
};

/**
 * Process a receipt image
 * @param base64Image - Base64 encoded image
 * @param type - Image MIME type
 * @returns Promise resolving to the processed receipt data
 */
export const processReceipt = async (base64Image: string, type = 'image/jpeg') => {
  const options: RequestInit = {
    method: 'POST',
    body: JSON.stringify({
      image: base64Image,
      name: 'receipt.jpg',
      type
    }),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };
  
  const response = await authFetch(PROCESS_RECEIPT_URL, options);
  
  if (!response.ok) {
    const text = await response.text();
    console.error('Process receipt error:', text);
    throw new Error(`Error processing receipt: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Save receipt data to the database
 * @param receiptData - The receipt data to save
 * @returns Promise resolving to the save response
 */
export const saveReceipt = async (receiptData: any) => {
  const options: RequestInit = {
    method: 'POST',
    body: JSON.stringify(receiptData),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };
  
  const response = await authFetch(SAVE_RECEIPT_URL, options);
  
  if (!response.ok) {
    const text = await response.text();
    console.error('Save receipt error:', text);
    throw new Error(`Error saving receipt: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Load a receipt by ID
 * @param id - The receipt ID
 * @returns Promise resolving to the loaded receipt data
 */
export const loadReceiptById = async (id: string) => {
  const options: RequestInit = {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  };
  
  const response = await authFetch(`${LOAD_RECEIPT_URL}/${id}`, options);
  
  if (!response.ok) {
    const text = await response.text();
    console.error('Load receipt error:', text);
    throw new Error(`Error loading receipt: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Update a receipt by ID
 * @param id - The receipt ID
 * @param updateData - The data to update
 * @returns Promise resolving to the update response
 */
export const updateReceiptById = async (id: string, updateData: any) => {
  const options: RequestInit = {
    method: 'PUT',
    body: JSON.stringify(updateData),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };
  
  const response = await authFetch(`${UPDATE_RECEIPT_URL}/${id}`, options);
  
  if (!response.ok) {
    const text = await response.text();
    console.error('Update receipt error:', text);
    throw new Error(`Error updating receipt: ${response.status}`);
  }
  
  return response.json();
};

// Add default export to prevent Expo Router warnings
export default {
  authFetch,
  processReceipt,
  saveReceipt,
  loadReceiptById,
  updateReceiptById,
}; 