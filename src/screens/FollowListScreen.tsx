import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { doc, onSnapshot, getDocs, collection, query, where } from 'firebase/firestore';

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
  followersCount: number;
  followingCount: number;
}

interface RouteParams {
  userId: string;
  userName: string;
  type: 'followers' | 'following';
}

export default function FollowListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, userName, type } = (route.params as RouteParams) || {};
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const userDocRef = doc(db, userDoc(userId));
    const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
      if (!docSnap.exists()) {
        setLoading(false);
        return;
      }

      const userData = docSnap.data();
      const userIds = type === 'followers' ? userData.followers || [] : userData.following || [];

      if (userIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      try {
        // Fetch user profiles for all user IDs
        // Note: Firestore 'in' queries are limited to 10 items
        const chunks = [];
        for (let i = 0; i < userIds.length; i += 10) {
          chunks.push(userIds.slice(i, i + 10));
        }

        const allUsers: UserData[] = [];
        
        for (const chunk of chunks) {
          const usersQuery = query(
            collection(db, 'artifacts/sportconnect/public/data/users'),
            where('uid', 'in', chunk)
          );
          
          const querySnapshot = await getDocs(usersQuery);
          const chunkUsers = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as UserData));
          
          allUsers.push(...chunkUsers);
        }

        // Sort to maintain the original order from the userIds array
        const sortedUsers = userIds.map(id => 
          allUsers.find(user => user.uid === id)
        ).filter(Boolean) as UserData[];

        setUsers(sortedUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [userId, type]);

  const handleUserPress = (selectedUser: UserData) => {
    if (selectedUser.uid === user?.uid) {
      // Navigate to own profile (main profile tab)
      navigation.navigate('Profile' as never);
    } else {
      // Navigate to other user's profile
      navigation.navigate('UserProfile' as never, {
        userId: selectedUser.uid,
        userName: selectedUser.displayName,
      } as never);
    }
  };

  const renderUserItem = ({ item }: { item: UserData }) => (
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
          <Text style={styles.displayName}>{item.displayName}</Text>
          <Text style={styles.email}>{item.email}</Text>
          {item.bio && <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>}
          
          <View style={styles.statsRow}>
            <Text style={styles.statsText}>
              {item.followersCount} followers • {item.followingCount} following
            </Text>
          </View>
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name={type === 'followers' ? 'people-outline' : 'person-add-outline'} 
        size={64} 
        color={COLORS.gray} 
      />
      <Text style={styles.emptyTitle}>
        No {type === 'followers' ? 'followers' : 'following'} yet
      </Text>
      <Text style={styles.emptyText}>
        {type === 'followers' 
          ? `${userId === user?.uid ? 'You don\'t' : `${userName} doesn\'t`} have any followers yet`
          : `${userId === user?.uid ? 'You\'re not' : `${userName} isn\'t`} following anyone yet`
        }
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={COLORS.black} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
        {userName}'s {type === 'followers' ? 'Followers' : 'Following'}
      </Text>
      <View style={{ width: 24 }} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading {type}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      {renderHeader()}
      
      <FlatList
        data={users}
        keyExtractor={(item) => item.uid}
        renderItem={renderUserItem}
        ListEmptyComponent={renderEmptyState}
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
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
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
  userItem: {
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
  bio: {
    fontSize: 14,
    color: COLORS.black,
    marginTop: 4,
  },
  statsRow: {
    marginTop: 6,
  },
  statsText: {
    fontSize: 12,
    color: COLORS.gray,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
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
    lineHeight: 22,
  },
  listContainer: {
    paddingBottom: 20,
  },
});