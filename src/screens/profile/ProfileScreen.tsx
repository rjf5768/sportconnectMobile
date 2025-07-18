import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  getDocs,
} from 'firebase/firestore';

import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { PATHS } from '../../services/firestoreService';
import { userDoc } from '../../utils/paths';
import { logout } from '../../services/authService';
import PostCard from '../../components/posts/PostCard';
import { COLORS, SIZES } from '../../constants';
import { Post } from '../../types';
import { AppNavigationProp } from '../../types/navigation';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  followers: string[];
  following: string[];
  likedPosts: string[];
  location?: {
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
    formattedAddress: string;
  };
  sportRatings?: {
    tennis?: number;
    basketball?: number;
    soccer?: number;
    football?: number;
    baseball?: number;
    golf?: number;
    swimming?: number;
    running?: number;
  };
  createdAt: any;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<AppNavigationProp>();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'liked'>('posts');
  const [loading, setLoading] = useState(true);
  const [loadingLiked, setLoadingLiked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load user profile
  useEffect(() => {
    if (!user?.uid) return;
    
    const docRef = doc(db, userDoc(user.uid));
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const profileData: UserProfile = {
          uid: data.uid || user.uid,
          email: data.email || '',
          displayName: data.displayName || 'Unknown User',
          bio: data.bio || '',
          profileImageUrl: data.profileImageUrl || '',
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0,
          postsCount: data.postsCount || 0,
          followers: data.followers || [],
          following: data.following || [],
          likedPosts: data.likedPosts || [],
          location: data.location,
          sportRatings: data.sportRatings || {},
          createdAt: data.createdAt
        };
        setUserProfile(profileData);
      }
      setLoading(false);
    });
    
    return unsubscribe;
  }, [user?.uid]);

  // Load user posts
  useEffect(() => {
    if (!user?.uid) return;
    
    const q = query(
      collection(db, PATHS.posts), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      setUserPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));
    });

    return unsubscribe;
  }, [user?.uid]);

  // Load liked posts when profile changes or liked tab is active
  useEffect(() => {
    if (!userProfile?.likedPosts || userProfile.likedPosts.length === 0) {
      setLikedPosts([]);
      return;
    }

    if (activeTab === 'liked') {
      fetchLikedPosts();
    }
  }, [userProfile?.likedPosts, activeTab]);

  const fetchLikedPosts = async () => {
    if (!userProfile?.likedPosts || userProfile.likedPosts.length === 0) {
      setLikedPosts([]);
      return;
    }

    setLoadingLiked(true);
    
    try {
      // Firestore 'in' queries are limited to 10 items, so we might need to chunk if more than 10 liked posts
      const chunks = [];
      for (let i = 0; i < userProfile.likedPosts.length; i += 10) {
        chunks.push(userProfile.likedPosts.slice(i, i + 10));
      }

      const allLikedPosts: Post[] = [];
      
      for (const chunk of chunks) {
        const q = query(
          collection(db, PATHS.posts),
          where('__name__', 'in', chunk)
        );
        
        const querySnapshot = await getDocs(q);
        const posts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Post));
        
        allLikedPosts.push(...posts);
      }

      // Sort by created date descending
      allLikedPosts.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        const aTime = a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      
      setLikedPosts(allLikedPosts);
    } catch (error) {
      console.error('Error fetching liked posts:', error);
      Alert.alert('Error', 'Failed to load liked posts');
    } finally {
      setLoadingLiked(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          }
        }
      ]
    );
  };

  const handleSettings = () => {
    navigation.navigate('Settings');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'liked') {
      await fetchLikedPosts();
    }
    // User posts refresh is handled automatically by onSnapshot
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderHeader = () => (
    <View style={styles.profileHeader}>
      <View style={styles.profileHeaderTop}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={handleSettings} style={styles.headerButton}>
            <Ionicons name="settings-outline" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
            <Ionicons name="log-out-outline" size={24} color={COLORS.black} />
          </TouchableOpacity>
        </View>
      </View>

      {userProfile && (
        <>
          <View style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              {userProfile.profileImageUrl ? (
                <Image 
                  source={{ uri: userProfile.profileImageUrl }} 
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {userProfile.displayName?.[0]?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.userInfo}>
              <Text style={styles.displayName}>{userProfile.displayName}</Text>
              <Text style={styles.email}>{userProfile.email}</Text>
              {userProfile.bio && (
                <Text style={styles.bio}>{userProfile.bio}</Text>
              )}
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userPosts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => navigation.navigate('FollowList', { 
                userId: userProfile.uid, 
                userName: userProfile.displayName,
                type: 'followers' 
              })}
            >
              <Text style={styles.statNumber}>{userProfile.followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => navigation.navigate('FollowList', { 
                userId: userProfile.uid, 
                userName: userProfile.displayName,
                type: 'following' 
              })}
            >
              <Text style={styles.statNumber}>{userProfile.followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
              onPress={() => setActiveTab('posts')}
            >
              <Ionicons 
                name="grid-outline" 
                size={20} 
                color={activeTab === 'posts' ? COLORS.primary : COLORS.gray} 
              />
              <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>
                Posts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'liked' && styles.activeTab]}
              onPress={() => setActiveTab('liked')}
            >
              <Ionicons 
                name="heart-outline" 
                size={20} 
                color={activeTab === 'liked' ? COLORS.primary : COLORS.gray} 
              />
              <Text style={[styles.tabText, activeTab === 'liked' && styles.activeTabText]}>
                Liked ({userProfile.likedPosts.length})
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  const renderEmptyPosts = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="grid-outline" size={48} color={COLORS.gray} />
      <Text style={styles.emptyText}>No posts yet</Text>
      <Text style={styles.emptySubtext}>Share your first sports moment!</Text>
    </View>
  );

  const renderEmptyLiked = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="heart-outline" size={48} color={COLORS.gray} />
      <Text style={styles.emptyText}>No liked posts yet</Text>
      <Text style={styles.emptySubtext}>Posts you like will appear here</Text>
    </View>
  );

  const renderLoadingLiked = () => (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingText}>Loading liked posts...</Text>
    </View>
  );

  const getCurrentData = () => {
    if (activeTab === 'posts') {
      return userPosts;
    } else {
      return likedPosts;
    }
  };

  const getCurrentEmptyComponent = () => {
    if (activeTab === 'posts') {
      return renderEmptyPosts();
    } else if (loadingLiked) {
      return renderLoadingLiked();
    } else {
      return renderEmptyLiked();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <View style={styles.loadingContainer}>
          <Text>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      <FlatList
        data={getCurrentData()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={getCurrentEmptyComponent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 2,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.gray,
  },
  profileHeader: {
    backgroundColor: COLORS.white,
    paddingBottom: SIZES.padding,
    marginBottom: SIZES.margin,
  },
  profileHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: SIZES.margin,
  },
  profileInfo: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: SIZES.margin,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  email: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  bio: {
    fontSize: 14,
    color: COLORS.black,
    marginTop: 8,
    lineHeight: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginTop: SIZES.margin * 2,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
  },
  activeTabText: {
    color: COLORS.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 4,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: SIZES.margin,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 8,
  },
  listContainer: {
    paddingBottom: 20,
  },
});