import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView 
} from 'react-native';
import { signUp, signIn } from '../../services/authService';
import { COLORS, SIZES } from '../../constants';

// Function to convert Firebase error codes to user-friendly messages
const getErrorMessage = (error: any): string => {
  const errorCode = error?.code || '';
  
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please try again.';
    
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    
    case 'auth/operation-not-allowed':
      return 'Email/password accounts are not enabled.';
    
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    
    case 'auth/requires-recent-login':
      return 'Please log out and log back in to continue.';
    
    case 'auth/credential-already-in-use':
      return 'This credential is already associated with a different account.';
    
    case 'auth/invalid-verification-code':
      return 'Invalid verification code.';
    
    case 'auth/invalid-verification-id':
      return 'Invalid verification ID.';
    
    case 'auth/missing-email':
      return 'Please enter your email address.';
    
    case 'auth/missing-password':
      return 'Please enter your password.';
    
    case 'auth/internal-error':
      return 'An internal error occurred. Please try again.';
    
    case 'auth/popup-closed-by-user':
      return 'Authentication was cancelled.';
    
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for this operation.';
    
    default:
      // For any unhandled errors, provide a generic message
      if (error?.message) {
        // Clean up the error message by removing Firebase prefixes
        const cleanMessage = error.message
          .replace(/Firebase: /g, '')
          .replace(/Error \([^)]*\)/g, '')
          .replace(/auth\//g, '')
          .trim();
        
        // If it's still a technical message, provide a generic one
        if (cleanMessage.includes('auth/') || cleanMessage.length > 100) {
          return 'An error occurred during authentication. Please try again.';
        }
        
        return cleanMessage;
      }
      
      return 'An unexpected error occurred. Please try again.';
  }
};

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (isSignUp && !displayName.trim()) {
      Alert.alert('Error', 'Display name is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Basic password validation
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email.trim(), password, displayName.trim());
        Alert.alert('Success', 'Account created successfully!');
      } else {
        await signIn(email.trim(), password);
        // Don't show success alert for sign in, just let them into the app
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      const userFriendlyMessage = getErrorMessage(error);
      Alert.alert('Authentication Error', userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>SportConnect</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </Text>
        </View>

        <View style={styles.form}>
          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="Display Name"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              editable={!loading}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password (6+ characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={loading}
          >
            <Text style={[styles.switchText, loading && styles.switchTextDisabled]}>
              {isSignUp 
                ? 'Already have an account? Sign In' 
                : "Don't have an account? Sign Up"
              }
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SIZES.padding * 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
  },
  form: {
    backgroundColor: COLORS.white,
    padding: SIZES.padding * 2,
    borderRadius: SIZES.borderRadius * 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: SIZES.borderRadius,
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
    fontSize: 16,
    backgroundColor: COLORS.white,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SIZES.padding,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
    marginTop: SIZES.margin,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: SIZES.margin * 2,
    alignItems: 'center',
  },
  switchText: {
    color: COLORS.primary,
    fontSize: 14,
  },
  switchTextDisabled: {
    opacity: 0.5,
  },
});