import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { 
  doc, 
  runTransaction, 
  serverTimestamp,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
} from 'firebase/firestore';

import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { userDoc } from '../../utils/paths';
import { PATHS } from '../../services/firestoreService';
import { COLORS, SIZES } from '../../constants';
import { Post } from '../../types';

interface Comment {
  id: string;
  text: string;
  userId: string;
  userDisplayName: string;
  userProfileImageUrl?: string;
  createdAt: any;
}

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [likeLoading, setLikeLoading] = useState(false);
  const [currentPost, setCurrentPost] = useState(post);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Listen to real-time updates for this specific post
  useEffect(() => {
    const postRef = doc(db, `${PATHS.posts}/${post.id}`);
    
    const unsubscribe = onSnapshot(postRef, (docSnap) => {
      if (docSnap.exists()) {
        const updatedPost = { id: docSnap.id, ...docSnap.data() } as Post;
        setCurrentPost(updatedPost);
      }
    }, (error) => {
      console.error('Error listening to post updates:', error);
    });

    return unsubscribe;
  }, [post.id]);

  // Listen to comments when modal is open
  useEffect(() => {
    if (!showComments) return;

    const commentsRef = collection(db, `${PATHS.posts}/${post.id}/comments`);
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Comment));
      setComments(commentsData);
    });

    return unsubscribe;
  }, [showComments, post.id]);

  // Also update when the prop changes (for initial load)
  useEffect(() => {
    setCurrentPost(post);
  }, [post]);

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

    try {
      const postRef = doc(db, `${PATHS.posts}/${post.id}`);
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
      Alert.alert('Error', 'Failed to update like');
    } finally {
      setLikeLoading(false);
    }
  };

  const handleComment = () => {
    setShowComments(true);
  };

  const addComment = async () => {
    if (!user || !newComment.trim() || addingComment) return;

    setAddingComment(true);

    try {
      const commentsRef = collection(db, `${PATHS.posts}/${post.id}/comments`);
      
      await addDoc(commentsRef, {
        text: newComment.trim(),
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        userProfileImageUrl: '', // You can add profile image logic later
        createdAt: serverTimestamp(),
      });

      // Update post comment count
      const postRef = doc(db, `${PATHS.posts}/${post.id}`);
      await runTransaction(db, async (tx) => {
        const postSnap = await tx.get(postRef);
        if (postSnap.exists()) {
          const currentCount = postSnap.data().commentCount || 0;
          tx.update(postRef, { commentCount: currentCount + 1 });
        }
      });

      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };

  const handleUserPress = () => {
    if (currentPost.userId === user?.uid) {
      // Navigate to own profile (main profile tab)
      navigation.navigate('Profile' as never);
    } else {
      // Navigate to other user's profile
      navigation.navigate('UserProfile' as never, {
        userId: currentPost.userId,
        userName: currentPost.userDisplayName,
      } as never);
    }
  };

  const renderCommentItem = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <View style={styles.commentAvatar}>
        <Text style={styles.commentAvatarText}>
          {item.userDisplayName?.[0]?.toUpperCase() || 'U'}
        </Text>
      </View>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentDisplayName}>{item.userDisplayName}</Text>
          <Text style={styles.commentTimestamp}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
      </View>
    </View>
  );

  const renderCommentsModal = () => (
    <Modal
      visible={showComments}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView 
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Comments</Text>
          <TouchableOpacity onPress={() => setShowComments(false)}>
            <Ionicons name="close" size={24} color={COLORS.black} />
          </TouchableOpacity>
        </View>

        {/* Comments List */}
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderCommentItem}
          style={styles.commentsList}
          contentContainerStyle={styles.commentsListContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubble-outline" size={48} color={COLORS.gray} />
              <Text style={styles.emptyCommentsText}>No comments yet</Text>
              <Text style={styles.emptyCommentsSubtext}>Be the first to comment!</Text>
            </View>
          }
        />

        {/* Add Comment Input */}
        <View style={styles.addCommentContainer}>
          <View style={styles.addCommentAvatar}>
            <Text style={styles.addCommentAvatarText}>
              {user?.displayName?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
          <TextInput
            style={styles.addCommentInput}
            placeholder="Add a comment..."
            placeholderTextColor={COLORS.gray}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={addComment}
            disabled={!newComment.trim() || addingComment}
            style={[
              styles.addCommentButton,
              (!newComment.trim() || addingComment) && styles.addCommentButtonDisabled
            ]}
          >
            <Text style={[
              styles.addCommentButtonText,
              (!newComment.trim() || addingComment) && styles.addCommentButtonTextDisabled
            ]}>
              {addingComment ? 'Adding...' : 'Post'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity onPress={handleUserPress} style={styles.header}>
        {currentPost.userProfileImageUrl ? (
          <Image 
            source={{ uri: currentPost.userProfileImageUrl }} 
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {currentPost.userDisplayName?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        
        <View style={styles.userInfo}>
          <Text style={styles.displayName}>{currentPost.userDisplayName}</Text>
          <Text style={styles.timestamp}>{formatTimeAgo(currentPost.createdAt)}</Text>
        </View>
      </TouchableOpacity>

      {/* Content */}
      {currentPost.text && (
        <Text style={styles.postText}>{currentPost.text}</Text>
      )}

      {/* Image */}
      {currentPost.imageUrl && (
        <Image source={{ uri: currentPost.imageUrl }} style={styles.postImage} />
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
          <Text style={styles.actionText}>{currentPost.commentCount || 0}</Text>
        </TouchableOpacity>
      </View>

      {/* Comments Modal */}
      {renderCommentsModal()}
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
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    padding: SIZES.padding,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: SIZES.margin,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.margin / 2,
  },
  commentAvatarText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentDisplayName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginRight: 8,
  },
  commentTimestamp: {
    fontSize: 12,
    color: COLORS.gray,
  },
  commentText: {
    fontSize: 14,
    color: COLORS.black,
    lineHeight: 18,
  },
  emptyComments: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 4,
  },
  emptyCommentsText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: SIZES.margin,
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 8,
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 1.5,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    backgroundColor: COLORS.white,
  },
  addCommentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.margin,
  },
  addCommentAvatarText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  addCommentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 24,
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    marginRight: SIZES.margin,
    maxHeight: 100,
    fontSize: 14,
    textAlignVertical: 'center',
  },
  addCommentButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding * 1.2,
    paddingVertical: 10,
    borderRadius: 24,
    minWidth: 60,
    alignItems: 'center',
  },
  addCommentButtonDisabled: {
    backgroundColor: COLORS.gray,
    opacity: 0.5,
  },
  addCommentButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  addCommentButtonTextDisabled: {
    color: COLORS.white,
  },
});