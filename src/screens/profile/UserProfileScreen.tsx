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
import { useNavigation, useRoute } from '@react-navigation/native';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { PATHS } from '../../services/firestoreService';
import { userDoc } from '../../utils/paths';
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

interface RouteParams {
  userId: string;
  userName?: string;
}

export default function UserProfileScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute();
  const { userId, userName } = (route.params as RouteParams) || {};
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Load target user profile
  useEffect(() => {
    if (!userId) return;
    
    const docRef = doc(db, userDoc(userId));
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const profileData: UserProfile = {
          uid: data.uid || userId,
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
  }, [userId]);

  // Load current user profile (for follow status)
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
        setCurrentUserProfile(profileData);
      }
    });
    
    return unsubscribe;
  }, [user?.uid]);

  // Load user posts
  useEffect(() => {
    if (!userId) return;
    
    const q = query(
      collection(db, PATHS.posts), 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      setUserPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));
    });

    return unsubscribe;
  }, [userId]);

  const isFollowing = currentUserProfile?.following.includes(userId) || false;

  const handleFollow = async () => {
    if (!user?.uid || !userId || followLoading) return;
    
    setFollowLoading(true);

    try {
      const currentUserRef = doc(db, userDoc(user.uid));
      const targetUserRef = doc(db, userDoc(userId));

      await runTransaction(db, async (tx) => {
        const currentUserSnap = await tx.get(currentUserRef);
        const targetUserSnap = await tx.get(targetUserRef);

        if (!targetUserSnap.exists()) {
          throw new Error('User not found');
        }

        const currentUserData = currentUserSnap.exists() ? currentUserSnap.data() : {};
        const targetUserData = targetUserSnap.data();

        const currentFollowing: string[] = currentUserData.following || [];
        const targetFollowers: string[] = targetUserData.followers || [];

        const isCurrentlyFollowing = currentFollowing.includes(userId);

        const newCurrentFollowing = isCurrentlyFollowing
          ? currentFollowing.filter(id => id !== userId)
          : [...currentFollowing, userId];

        const newTargetFollowers = isCurrentlyFollowing
          ? targetFollowers.filter(id => id !== user.uid)
          : [...targetFollowers, user.uid];

        // Update current user's following list
        if (currentUserSnap.exists()) {
          tx.update(currentUserRef, {
            following: newCurrentFollowing,
            followingCount: newCurrentFollowing.length,
          });
        } else {
          tx.set(currentUserRef, {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Unknown User',
            bio: '',
            profileImageUrl: '',
            followersCount: 0,
            followingCount: newCurrentFollowing.length,
            postsCount: 0,
            followers: [],
            following: newCurrentFollowing,
            likedPosts: [],
            sportRatings: {},
            createdAt: serverTimestamp(),
          });
        }

        // Update target user's followers list
        tx.update(targetUserRef, {
          followers: newTargetFollowers,
          followersCount: newTargetFollowers.length,
        });
      });

    } catch (error) {
      console.error('Error following user:', error);
      Alert.alert('Error', 'Failed to follow user');
    } finally {
      setFollowLoading(false);
    }
  };

  const formatLocation = (location?: UserProfile['location']) => {
    if (!location) return null;
    return `${location.city}, ${location.state}`;
  };

  const formatSportRatings = (sportRatings?: UserProfile['sportRatings']) => {
    if (!sportRatings || Object.keys(sportRatings).length === 0) return null;
    
    return Object.entries(sportRatings)
      .slice(0, 3)
      .map(([sport, rating]) => `${sport}: ${rating}`)
      .join(' • ');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderHeader = () => (
    <View style={styles.profileHeader}>
      <View style={styles.profileHeaderTop}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {userProfile?.displayName || userName || 'Profile'}
        </Text>
        <View style={{ width: 24 }} />
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
              {formatLocation(userProfile.location) && (
                <View style={styles.locationContainer}>
                  <Ionicons name="location-outline" size={14} color={COLORS.gray} />
                  <Text style={styles.locationText}>{formatLocation(userProfile.location)}</Text>
                </View>
              )}
              {formatSportRatings(userProfile.sportRatings) && (
                <Text style={styles.sportRatings}>{formatSportRatings(userProfile.sportRatings)}</Text>
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

          {/* Follow Button */}
          {user?.uid !== userId && (
            <View style={styles.actionContainer}>
              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followingButton]}
                onPress={handleFollow}
                disabled={followLoading}
              >
                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                  {followLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.divider} />
        </>
      )}
    </View>
  );

  const renderEmptyPosts = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="grid-outline" size={48} color={COLORS.gray} />
      <Text style={styles.emptyText}>No posts yet</Text>
      <Text style={styles.emptySubtext}>
        {userProfile?.displayName} hasn't shared anything yet
      </Text>
    </View>
  );

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

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      <FlatList
        data={userPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyPosts}
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  errorText: {
    fontSize: 18,
    color: COLORS.error,
    marginBottom: SIZES.margin,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding * 2,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.borderRadius,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  profileInfo: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    alignItems: 'flex-start',
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
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.gray,
    marginLeft: 4,
  },
  sportRatings: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 6,
    fontWeight: '500',
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
  actionContainer: {
    paddingHorizontal: SIZES.padding * 2,
    paddingTop: SIZES.padding * 1.5,
  },
  followButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.borderRadius,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.gray,
  },
  followButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  followingButtonText: {
    color: COLORS.gray,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginTop: SIZES.padding * 1.5,
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