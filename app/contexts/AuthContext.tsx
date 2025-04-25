import React, { createContext, useContext, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { useAuth, signInAnonymousUser } from '@/app/services/auth';

// Type definitions for the Auth context
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInAnonymously: () => Promise<User>;
}

// Create the Auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Context Provider props
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Context Provider component
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { user, loading } = useAuth();
  
  // Function to sign in anonymously
  const signInAnonymously = async (): Promise<User> => {
    return await signInAnonymousUser();
  };
  
  // Provide the auth context value
  const value = {
    user,
    loading,
    signInAnonymously,
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use the Auth context
 */
export function useAuthContext() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
}

// Add default export to prevent Expo Router warnings
export default {
  AuthProvider,
  useAuthContext,
}; 