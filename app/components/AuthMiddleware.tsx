import React, { useEffect, ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuthContext } from '@/app/contexts/AuthContext';
import { ThemedText as Text } from '@/components/ThemedText';

interface AuthMiddlewareProps {
  children: ReactNode;
}

export function AuthMiddleware({ children }: AuthMiddlewareProps) {
  const { user, loading, signInAnonymously } = useAuthContext();
  
  useEffect(() => {
    // Sign in anonymously if not already signed in
    const signInIfNeeded = async () => {
      if (!loading && !user) {
        try {
          await signInAnonymously();
        } catch (error) {
          console.error('Failed to sign in anonymously:', error);
        }
      }
    };
    
    signInIfNeeded();
  }, [user, loading, signInAnonymously]);
  
  // Show loading indicator while determining auth state
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.text}>Setting up your session...</Text>
      </View>
    );
  }
  
  // Render children when authentication is complete
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    marginTop: 10,
    textAlign: 'center',
  },
});

// Add default export to prevent Expo Router warnings
export default AuthMiddleware; 