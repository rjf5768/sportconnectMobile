import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../../contexts/AuthContext';
import { createPost } from '../../services/firestoreService';
import { COLORS, SIZES } from '../../constants';

export default function CreatePostScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const maxLength = 280;

  const handlePost = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    if (!text.trim() && !image) {
      Alert.alert('Error', 'Please add some text or an image');
      return;
    }

    setLoading(true);
    try {
      await createPost(user.uid, text.trim(), user.displayName || 'Anonymous');
      Alert.alert('Success', 'Post created successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    setImage(null);
  };

  const getCharCountColor = () => {
    if (text.length > maxLength * 0.9) return COLORS.error;
    if (text.length > maxLength * 0.7) return '#F59E0B';
    return COLORS.gray;
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User not authenticated</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={(!text.trim() && !image) || loading}
          style={[styles.postButton, (!text.trim() && !image) && styles.postButtonDisabled]}
        >
          <Text style={[styles.postButtonText, (!text.trim() && !image) && styles.postButtonTextDisabled]}>
            {loading ? 'Posting...' : 'Post'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.content} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* User Info */}
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.displayName?.[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.displayName}>{user.displayName || 'Anonymous'}</Text>
              <Text style={styles.email}>{user.email || ''}</Text>
            </View>
          </View>

          {/* Text Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="What's happening in sports?"
              placeholderTextColor={COLORS.gray}
              multiline
              value={text}
              onChangeText={setText}
              maxLength={maxLength}
              autoFocus
            />
            
            {/* Character Count */}
            <View style={styles.charCountContainer}>
              <Text style={[styles.charCount, { color: getCharCountColor() }]}>
                {text.length}/{maxLength}
              </Text>
            </View>
          </View>

          {/* Image Preview */}
          {image && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.imagePreview} />
              <TouchableOpacity onPress={removeImage} style={styles.removeImageButton}>
                <Ionicons name="close-circle" size={24} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity onPress={pickImage} style={styles.actionButton}>
              <Ionicons name="image-outline" size={24} color={COLORS.primary} />
              <Text style={styles.actionText}>Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="location-outline" size={24} color={COLORS.gray} />
              <Text style={[styles.actionText, { color: COLORS.gray }]}>Location</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    backgroundColor: COLORS.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  postButton: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 8,
    borderRadius: SIZES.borderRadius,
    backgroundColor: COLORS.white,
  },
  postButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  postButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  postButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.margin * 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.margin,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  email: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 2,
  },
  inputContainer: {
    marginBottom: SIZES.margin * 2,
  },
  textInput: {
    fontSize: 18,
    color: COLORS.black,
    lineHeight: 24,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCountContainer: {
    alignItems: 'flex-end',
    marginTop: SIZES.margin,
  },
  charCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: SIZES.margin * 2,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: SIZES.borderRadius,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: SIZES.padding,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SIZES.margin * 2,
  },
  actionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
  },
});