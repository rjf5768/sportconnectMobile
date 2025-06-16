import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  doc, 
  runTransaction, 
  serverTimestamp,
} from 'firebase/firestore';

import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { userDoc } from '../../utils/paths';
import { COLORS, SIZES } from '../../constants';
import { Post } from '../../types';

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const [likeLoading, setLikeLoading] = useState(false);
  const [currentPost, setCurrentPost] = useState(post);

  const liked = user && (currentPost.likes || []).includes(user.uid);

  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  const toggleLike = async () => {
    if (!user || likeLoading) return;
    
    setLikeLoading(true);

    const originalPostState = { ...currentPost };
    
    // Optimistic UI update
    const newLikesArray = liked
      ? (currentPost.likes || []).filter(id => id !== user.uid)
      : [...(currentPost.likes || []), user.uid];

    setCurrentPost(prev => ({
      ...prev,
      likes: newLikesArray,
      likeCount: newLikesArray.length,
    }));
    
    try {
      const postRef = doc(db, `artifacts/sportconnect/public/data/posts/${post.id}`);
      const userRef = doc(db, userDoc(user.uid));
      
      await runTransaction(db, async (tx) => {
        const postSnap = await tx.get(postRef);
        const userSnap = await tx.get(userRef);
        
        if (!postSnap.exists()) throw new Error('Post does not exist');
        
        const postDataFromDb = postSnap.data();
        const userData = userSnap.exists() ? userSnap.data() : {};
        
        const currentLikes: string[] = postDataFromDb.likes || [];
        const userLikedPosts: string[] = userData.likedPosts || [];
        const isCurrentlyLiked = currentLikes.includes(user.uid);
        
        const newLikes = isCurrentlyLiked
          ? currentLikes.filter((id) => id !== user.uid)
          : [...currentLikes, user.uid];
        
        const newUserLikedPosts = isCurrentlyLiked
          ? userLikedPosts.filter((id) => id !== post.id)
          : [...userLikedPosts, post.id];
        
        // Update post likes
        tx.update(postRef, { likes: newLikes, likeCount: newLikes.length });
        
        // Update or create user document with liked posts
        if (userSnap.exists()) {
          tx.update(userRef, { likedPosts: newUserLikedPosts });
        } else {
          // Create user document if it doesn't exist
          tx.set(userRef, {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Unknown User',
            bio: '',
            profileImageUrl: '',
            followersCount: 0,
            followingCount: 0,
            postsCount: 0,
            followers: [],
            following: [],
            likedPosts: newUserLikedPosts,
            sportRatings: {},
            createdAt: serverTimestamp(),
          });
        }
      });
    } catch (error) {
      console.error('Error toggling like:', error);
      setCurrentPost(originalPostState); // Revert on error
      Alert.alert('Error', 'Failed to update like');
    } finally {
      setLikeLoading(false);
    }
  };

  const handleComment = () => {
    // TODO: Implement comments modal
    Alert.alert('Coming Soon', 'Comments feature will be available soon!');
  };

  const handleUserPress = () => {
    // TODO: Navigate to user profile
    Alert.alert('Profile', `View ${post.userDisplayName}'s profile`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity onPress={handleUserPress} style={styles.header}>
        {post.userProfileImageUrl ? (
          <Image 
            source={{ uri: post.userProfileImageUrl }} 
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {post.userDisplayName?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        
        <View style={styles.userInfo}>
          <Text style={styles.displayName}>{post.userDisplayName}</Text>
          <Text style={styles.timestamp}>{formatTimeAgo(post.createdAt)}</Text>
        </View>
      </TouchableOpacity>

      {/* Content */}
      {post.text && (
        <Text style={styles.postText}>{post.text}</Text>
      )}

      {/* Image */}
      {post.imageUrl && (
        <Image source={{ uri: post.imageUrl }} style={styles.postImage} />
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          onPress={toggleLike}
          disabled={likeLoading}
          style={[styles.actionButton, likeLoading && styles.actionButtonDisabled]}
        >
          <Ionicons 
            name={liked ? 'heart' : 'heart-outline'} 
            size={24} 
            color={liked ? COLORS.error : COLORS.gray} 
          />
          <Text style={[styles.actionText, liked && { color: COLORS.error }]}>
            {currentPost.likeCount || 0}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleComment} style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={24} color={COLORS.gray} />
          <Text style={styles.actionText}>{post.commentCount || 0}</Text>
        </TouchableOpacity>
      </View>

      {/* Like count */}
      {(currentPost.likeCount || 0) > 0 && (
        <Text style={styles.likeCount}>
          {currentPost.likeCount} {currentPost.likeCount === 1 ? 'like' : 'likes'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.margin,
    marginVertical: 4,
    borderRadius: SIZES.borderRadius,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.padding,
    paddingBottom: SIZES.padding / 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SIZES.margin,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.margin,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  postText: {
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.black,
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding / 2,
  },
  postImage: {
    width: '100%',
    height: 200,
    marginVertical: SIZES.margin / 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding / 2,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SIZES.margin * 2,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
  },
  likeCount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding / 2,
  },
});