import React, { useState, useEffect } from 'react';
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
import { collection, query, getDocs, doc, onSnapshot } from 'firebase/firestore';

import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { userDoc } from '../../utils/paths';
import { COLORS, SIZES } from '../../constants';

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

interface CurrentUserProfile {
  location?: {
    latitude: number;
    longitude: number;
  };
}

const TRENDING_TOPICS = [
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
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserData[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile>({});
  const [activeTab, setActiveTab] = useState<'users' | 'trending'>('users');

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

  useEffect(() => {
    if (searchTerm.trim()) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, user?.uid, currentUserProfile]);

  const searchUsers = async () => {
    try {
      const q = query(collection(db, 'artifacts/sportconnect/public/data/users'));
      const querySnapshot = await getDocs(q);
      
      const users = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as UserData))
        .filter(userData => 
          userData.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          userData.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .filter(userData => userData.uid !== user.uid)
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
      
      setSearchResults(users);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const formatDistance = (distance?: number): string => {
    if (!distance) return '';
    if (distance < 1) return `${(distance * 1000).toFixed(0)}m away`;
    if (distance < 10) return `${distance.toFixed(1)}km away`;
    return `${Math.round(distance)}km away`;
  };

  const renderUserItem = ({ item }: { item: UserData }) => (
    <TouchableOpacity style={styles.userItem}>
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
          {item.bio && <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>