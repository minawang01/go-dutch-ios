import { signInAnonymously, User, onAuthStateChanged } from 'firebase/auth';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/app/config/firebase';

// Key for storing auth state
const AUTH_STATE_KEY = '@go-dutch:auth-state';

/**
 * Sign in anonymously and return the user
 * @returns Promise resolving to the user object
 */
export const signInAnonymousUser = async (): Promise<User> => {
  try {
    const { user } = await signInAnonymously(auth);
    return user;
  } catch (error) {
    console.error('Error signing in anonymously:', error);
    throw error;
  }
};

/**
 * Get the current authenticated user
 * @returns The current user or null if not authenticated
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Get the current auth token
 * @returns Promise resolving to the ID token or null
 */
export const getAuthToken = async (): Promise<string | null> => {
  const user = getCurrentUser();
  if (!user) return null;
  
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

/**
 * Add authorization headers to fetch request options
 * @param options - Fetch request options
 * @returns Promise resolving to enhanced options with auth headers
 */
export const addAuthHeader = async (options: RequestInit = {}): Promise<RequestInit> => {
  const token = await getAuthToken();
  
  if (!token) return options;
  
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`
    }
  };
};

/**
 * Hook to get and keep track of the current authentication state
 * @returns An object containing the current user and loading state
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Try to restore auth state from storage
    const restoreAuthState = async () => {
      try {
        const savedUser = await AsyncStorage.getItem(AUTH_STATE_KEY);
        if (savedUser) {
          // This is just to show the UI while the real auth state is being checked
          setUser(JSON.parse(savedUser));
        }
      } catch (error) {
        console.error('Error restoring auth state:', error);
      }
    };
    
    restoreAuthState();
    
    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      // Save auth state to storage
      if (currentUser) {
        try {
          await AsyncStorage.setItem(AUTH_STATE_KEY, JSON.stringify({
            uid: currentUser.uid,
            isAnonymous: currentUser.isAnonymous,
          }));
        } catch (error) {
          console.error('Error saving auth state:', error);
        }
      } else {
        try {
          await AsyncStorage.removeItem(AUTH_STATE_KEY);
        } catch (error) {
          console.error('Error removing auth state:', error);
        }
      }
    });
    
    // Clean up subscription
    return () => unsubscribe();
  }, []);
  
  return { user, loading };
};

// Add default export to prevent Expo Router warnings
export default {
  signInAnonymousUser,
  getCurrentUser,
  getAuthToken,
  addAuthHeader,
  useAuth,
}; 