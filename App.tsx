// App.tsx - Fixed version with proper TypeScript error handling
import React from 'react';
import { View, Text } from 'react-native';

export default function App() {
  try {
    // Import components only after verifying Firebase config exists
    const { AuthProvider } = require('./src/contexts/AuthContext');
    const AppNavigator = require('./src/navigation/AppNavigator').default;
    
    return (
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown configuration error';
    
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, color: 'red', textAlign: 'center' }}>
          Configuration Error
        </Text>
        <Text style={{ fontSize: 14, marginTop: 10, textAlign: 'center' }}>
          {errorMessage}
        </Text>
        <Text style={{ fontSize: 12, marginTop: 10, color: 'gray', textAlign: 'center' }}>
          Make sure .env.local exists with valid Firebase config
        </Text>
      </View>
    );
  }
}