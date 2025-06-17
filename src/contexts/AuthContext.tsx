// src/contexts/AuthContext.tsx - Fixed version with proper error handling
import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(
        auth, 
        (user) => {
          setUser(user);
          setLoading(false);
          setError(null);
        },
        (error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Authentication error occurred';
          console.error('Auth state change error:', error);
          setError(errorMessage);
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize authentication';
      console.error('Auth initialization error:', error);
      setError(errorMessage);
      setLoading(false);
    }
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, color: 'red', textAlign: 'center' }}>
          Authentication Error
        </Text>
        <Text style={{ fontSize: 14, marginTop: 10, textAlign: 'center' }}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};