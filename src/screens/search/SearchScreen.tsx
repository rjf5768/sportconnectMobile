import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { collection, query, getDocs, doc, onSnapshot } from 'firebase/firestore';

import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { userDoc } from '../../utils/paths';
import { COLORS, SIZES } from '../../constants';
import { AppNavigationProp } from '../../types/navigation';

interface UserData {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  bio?: string;
  profileImageUrl?: string;
  followersCount?: number;
  distance?: number;
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
}

interface TrendingTopic {
  name: string;
  posts: number;
}

interface CurrentUserProfile {
  location?: {
    latitude: number;
    longitude: number;
  };
}

const TRENDING_TOPICS: TrendingTopic[] = [
  { name: 'Football', posts: 1250 },
  { name: 'Basketball', posts: 987 },
  { name: 'Soccer', posts: 845 },
  { name: 'Tennis', posts: 623 },
  { name: 'Baseball', posts: 456 },
  { name: 'Hockey', posts: 334 },
];

// Haversine formula for distance calculation
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default function SearchScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<AppNavigationProp>();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserData[]>([]);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile>({});
  const [activeTab, setActiveTab] = useState<'users' | 'trending'>('users');
  const [loading, setLoading] = useState(false);

  // Get current user's profile for distance calculations
  useEffect(() => {
    if (!user?.uid) return;
    
    const unsubscribeUser = onSnapshot(doc(db, userDoc(user.uid)), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentUserProfile({
          location: data.location || null,
        });
      }
    });

    return unsubscribeUser;
  }, [user?.uid]);

  // Load all users once when component mounts
  useEffect(() => {
    if (!user?.uid) return;
    
    const loadUsers = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'artifacts/sportconnect/public/data/users'));
        const querySnapshot = await getDocs(q);
        
        const users = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as UserData))
          .filter(userData => userData.uid !== user.uid); // Filter out current user
        
        setAllUsers(users);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [user?.uid]);

  // Filter users based on search term and calculate distances
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    return allUsers
      .filter(userData => 
        userData.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userData.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .map(userData => {
        // Calculate distance if both users have location
        if (currentUserProfile.location && userData.location) {
          const distance = calculateDistance(
            currentUserProfile.location.latitude,
            currentUserProfile.location.longitude,
            userData.location.latitude,
            userData.location.longitude
          );
          return { ...userData, distance };
        }
        return userData;
      })
      .sort((a, b) => {
        // Sort by distance if available, otherwise alphabetically
        if (a.distance && b.distance) return a.distance - b.distance;
        if (a.distance && !b.distance) return -1;
        if (!a.distance && b.distance) return 1;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [searchTerm, allUsers, currentUserProfile]);

  // Update search results when filtered users change
  useEffect(() => {
    setSearchResults(filteredUsers);
  }, [filteredUsers]);

  const formatDistance = (distance?: number): string => {
    if (!distance) return '';
    if (distance < 1) return `${(distance * 1000).toFixed(0)}m away`;
    if (distance < 10) return `${distance.toFixed(1)}km away`;
    return `${Math.round(distance)}km away`;
  };

  const handleUserPress = useCallback((selectedUser: UserData) => {
    if (selectedUser.uid === user?.uid) {
      // Navigate to own profile (main profile tab)
      navigation.navigate('Profile');
    } else {
      // Navigate to other user's profile
      navigation.navigate('UserProfile', {
        userId: selectedUser.uid,
        userName: selectedUser.displayName,
      });
    }
  }, [user?.uid, navigation]);

  const renderUserItem = useCallback(({ item }: { item: UserData }) => (
    <TouchableOpacity style={styles.userItem} onPress={() => handleUserPress(item)}>
      <View style={styles.userInfo}>
        {item.profileImageUrl ? (
          <Image source={{ uri: item.profileImageUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {item.displayName?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        
        <View style={styles.userDetails}>
          <View style={styles.userHeader}>
            <Text style={styles.displayName}>{item.displayName}</Text>
            {item.distance && (
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceText}>{formatDistance(item.distance)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.email}>{item.email}</Text>
          {item.bio && <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>}
          
          {/* Sport ratings display */}
          {item.sportRatings && Object.keys(item.sportRatings).length > 0 && (
            <View style={styles.sportRatings}>
              {Object.entries(item.sportRatings).slice(0, 3).map(([sport, rating]) => (
                <View key={sport} style={styles.sportTag}>
                  <Text style={styles.sportTagText}>{sport}: {rating}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
    </TouchableOpacity>
  ), [handleUserPress, formatDistance]);

  const renderTrendingItem = useCallback(({ item }: { item: TrendingTopic }) => (
    <TouchableOpacity style={styles.trendingItem}>
      <View style={styles.trendingInfo}>
        <Text style={styles.trendingName}>#{item.name}</Text>
        <Text style={styles.trendingPosts}>{item.posts} posts</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
    </TouchableOpacity>
  ), []);

  const renderEmptyState = () => {
    if (activeTab === 'users') {
      if (loading) {
        return (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Loading users...</Text>
          </View>
        );
      }
      
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>
            {searchTerm ? 'No users found' : 'Search for users'}
          </Text>
          <Text style={styles.emptyText}>
            {searchTerm 
              ? 'Try searching with different keywords'
              : 'Enter a name or email to find other sports enthusiasts'
            }
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="trending-up-outline" size={64} color={COLORS.gray} />
        <Text style={styles.emptyTitle}>Trending Topics</Text>
        <Text style={styles.emptyText}>Discover what's popular in sports</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
        
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.gray} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor={COLORS.gray}
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'users' && styles.activeTab]}
            onPress={() => setActiveTab('users')}
          >
            <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
              Users
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'trending' && styles.activeTab]}
            onPress={() => setActiveTab('trending')}
          >
            <Text style={[styles.tabText, activeTab === 'trending' && styles.activeTabText]}>
              Trending
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Content */}
      {activeTab === 'users' ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <FlatList
          data={TRENDING_TOPICS}
          keyExtractor={(item) => item.name}
          renderItem={renderTrendingItem}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
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
    backgroundColor: COLORS.white,
    paddingBottom: SIZES.padding,
    marginBottom: SIZES.margin,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.padding,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    marginHorizontal: SIZES.margin,
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.margin,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.black,
    paddingVertical: SIZES.padding / 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  tab: {
    flex: 1,
    paddingVertical: SIZES.padding,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.gray,
  },
  activeTabText: {
    color: COLORS.primary,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.margin,
    marginVertical: 4,
    padding: SIZES.padding,
    borderRadius: SIZES.borderRadius,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: SIZES.margin,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  distanceBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 12,
    color: COLORS.gray,
  },
  email: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 2,
  },
  bio: {
    fontSize: 14,
    color: COLORS.black,
    marginTop: 4,
  },
  sportRatings: {
    flexDirection: 'row',
    marginTop: 6,
  },
  sportTag: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  sportTagText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: '500',
  },
  trendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.margin,
    marginVertical: 4,
    padding: SIZES.padding,
    borderRadius: SIZES.borderRadius,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  trendingInfo: {
    flex: 1,
  },
  trendingName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  trendingPosts: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 4,
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
    paddingHorizontal: SIZES.padding * 2,
  },
  listContainer: {
    paddingBottom: 20,
  },
});