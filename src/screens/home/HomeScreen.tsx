import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { collection, query, orderBy, onSnapshot, where, getDocs, doc } from 'firebase/firestore';

import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { PATHS } from '../../services/firestoreService';
import { userDoc } from '../../utils/paths';
import PostCard from '../../components/posts/PostCard';
import { COLORS, SIZES } from '../../constants';
import { Post } from '../../types';

interface UserProfile {
  location?: {
    latitude: number;
    longitude: number;
    city: string;
    state: string;
    country: string;
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

// Haversine formula to calculate distance between two points
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const calculateSportRatingDifference = (userRatings: any, postUserRatings: any): number => {
  if (!userRatings || !postUserRatings) return Infinity;
  
  const sports = ['tennis', 'basketball', 'soccer', 'football', 'baseball', 'golf', 'swimming', 'running'];
  let totalDiff = 0;
  let commonSports = 0;
  
  for (const sport of sports) {
    if (userRatings[sport] && postUserRatings[sport]) {
      totalDiff += Math.abs(userRatings[sport] - postUserRatings[sport]);
      commonSports++;
    }
  }
  
  if (commonSports === 0) return Infinity;
  return totalDiff / commonSports;
};

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [recommendedPosts, setRecommendedPosts] = useState<Post[]>([]);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get current user's profile for recommendations
  useEffect(() => {
    if (!user?.uid) return;
    
    const unsubscribeUser = onSnapshot(doc(db, userDoc(user.uid)), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentUserProfile({
          location: data.location || null,
          sportRatings: data.sportRatings || {}
        });
      }
    });

    return unsubscribeUser;
  }, [user?.uid]);

  // Load posts
  useEffect(() => {
    const q = query(collection(db, PATHS.posts), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Post));
      
      setRecentPosts(allPosts);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Generate recommendations when user profile or posts change
  useEffect(() => {
    if (recentPosts.length > 0 && (currentUserProfile.location || Object.keys(currentUserProfile.sportRatings || {}).length > 0)) {
      generateRecommendations();
    } else {
      setPosts(recentPosts.filter(post => post.userId !== user?.uid));
    }
  }, [recentPosts, currentUserProfile, user?.uid]);

  const generateRecommendations = async () => {
    try {
      // Get all users for their profiles
      const usersQuery = query(collection(db, 'artifacts/sportconnect/public/data/users'));
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.reduce((acc, doc) => {
        acc[doc.data().uid] = doc.data();
        return acc;
      }, {} as Record<string, any>);

      // Score posts based on location and sport ratings
      const scoredPosts = recentPosts
        .filter(post => post.userId !== user?.uid) // Exclude own posts
        .map(post => {
          const postUser = users[post.userId];
          
          // Use stored user location from post if available, otherwise user profile location
          const postUserLocation = post.userLocation || postUser?.location;
          
          let distance = Infinity;
          if (currentUserProfile.location && postUserLocation) {
            distance = calculateDistance(
              currentUserProfile.location.latitude,
              currentUserProfile.location.longitude,
              postUserLocation.latitude,
              postUserLocation.longitude
            );
          }
          
          const ratingDifference = calculateSportRatingDifference(
            currentUserProfile.sportRatings, 
            post.userSportRatings || postUser?.sportRatings
          );
          
          // Location is more important than rating (weight: 70% location, 30% rating)
          let locationScore = 1000;
          if (distance !== Infinity) {
            if (distance <= 10) {
              locationScore = distance * 10; // 0-100
            } else if (distance <= 50) {
              locationScore = 100 + (distance - 10) * 5; // 100-300
            } else if (distance <= 200) {
              locationScore = 300 + (distance - 50) * 2; // 300-600
            } else {
              locationScore = 600 + Math.min(distance - 200, 400); // 600-1000
            }
          }
          
          const ratingScore = ratingDifference === Infinity ? 100 : ratingDifference * 10;
          const totalScore = (locationScore * 0.7) + (ratingScore * 0.3);
          
          return {
            ...post,
            userProfileImageUrl: postUser?.profileImageUrl || '',
            score: totalScore,
            distance: distance === Infinity ? undefined : distance
          };
        })
        .sort((a, b) => (a.score || 0) - (b.score || 0));

      setRecommendedPosts(scoredPosts.slice(0, 20));
      setPosts(scoredPosts);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      setPosts(recentPosts.filter(post => post.userId !== user?.uid));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await generateRecommendations();
    setRefreshing(false);
  };

  const handleCreatePost = () => {
    navigation.navigate('CreatePost' as never);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>SportConnect</Text>
      <TouchableOpacity onPress={handleCreatePost} style={styles.createButton}>
        <Ionicons name="add" size={24} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  );

  const renderRecommendationBanner = () => {
    if (!currentUserProfile.location && Object.keys(currentUserProfile.sportRatings || {}).length === 0) {
      return (
        <View style={styles.recommendationBanner}>
          <Ionicons name="information-circle" size={20} color={COLORS.primary} />
          <Text style={styles.bannerText}>
            Set your location and sport ratings in profile settings for personalized recommendations!
          </Text>
        </View>
      );
    }

    if (recommendedPosts.length > 0) {
      return (
        <View style={styles.recommendationHeader}>
          <Text style={styles.recommendationTitle}>Recommended for You</Text>
          <Text style={styles.recommendationSubtitle}>
            Based on your location and interests
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
          <Text>Loading posts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      {renderHeader()}
      
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={renderRecommendationBanner}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recommendationBanner: {
    backgroundColor: '#EEF2FF',
    margin: SIZES.margin,
    padding: SIZES.padding,
    borderRadius: SIZES.borderRadius,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bannerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.primary,
  },
  recommendationHeader: {
    margin: SIZES.margin,
    marginBottom: SIZES.margin / 2,
  },
  recommendationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  recommendationSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
});