import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc
} from 'firebase/firestore';

import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { PATHS } from '../../services/firestoreService';
import { userDoc } from '../../utils/paths';
import PostCard from '../../components/posts/PostCard';
import { COLORS, SIZES } from '../../constants';
import { Post } from '../../types';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  followers: string[];
  following: string[];
  likedPosts: string[];
  createdAt: any;
}

export default function ActivityScreen() {
  const { user } = useAuth();
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Get current user's profile to access following list
  useEffect(() => {
    if (!user?.uid) return;
    
    const userDocRef = doc(db, userDoc(user.uid));
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const profileData: UserProfile = {
          uid: data.uid || user.uid,
          email: data.email || '',
          displayName: data.displayName || 'Unknown User',
          bio: data.bio || '',
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0,
          postsCount: data.postsCount || 0,
          followers: data.followers || [],
          following: data.following || [],
          likedPosts: data.likedPosts || [],
          createdAt: data.createdAt
        };
        setUserProfile(profileData);
      }
    });
    
    return unsubscribe;
  }, [user?.uid]);

  // Get posts from users that the current user is following
  useEffect(() => {
    if (!userProfile || !userProfile.following || userProfile.following.length === 0) {
      setFollowingPosts([]);
      setLoading(false);
      return;
    }

    // Create query to get posts from followed users
    const q = query(
      collection(db, PATHS.posts),
      where('userId', 'in', userProfile.following),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const posts = snap.docs.map((d) => ({ 
        id: d.id, 
        ...d.data() 
      } as Post));
      setFollowingPosts(posts);
      setLoading(false);
    });

    return unsubscribe;
  }, [userProfile?.following]);

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Activity</Text>
      <Text style={styles.headerSubtitle}>
        Latest from {userProfile?.following?.length || 0} people you follow
      </Text>
    </View>
  );

  const renderEmptyState = () => {
    if (!userProfile?.following || userProfile.following.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>No Activity Yet</Text>
          <Text style={styles.emptyText}>
            Follow other users to see their posts here!
          </Text>
          <Text style={styles.emptySubtext}>
            Go to the Search tab to find and follow other sports enthusiasts.
          </Text>
        </View>
      );
    }

    if (followingPosts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>No Recent Posts</Text>
          <Text style={styles.emptyText}>
            None of the {userProfile.following.length} people you follow have posted recently.
          </Text>
          <Text style={styles.emptySubtext}>
            Check back later for new content!
          </Text>
        </View>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading activity feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      {renderHeader()}
      
      {followingPosts.length > 0 ? (
        <FlatList
          data={followingPosts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard post={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        renderEmptyState()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.gray,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: SIZES.margin,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: SIZES.margin,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: SIZES.margin / 2,
  },
  listContainer: {
    paddingBottom: 20,
  },
});