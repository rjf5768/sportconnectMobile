import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { doc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import * as Location from 'expo-location';

import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { userDoc } from '../../utils/paths';
import { COLORS, SIZES } from '../../constants';

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

const SPORTS = [
  { key: 'tennis', label: 'Tennis (UTR Rating)', max: 16 },
  { key: 'basketball', label: 'Basketball (1-10)', max: 10 },
  { key: 'soccer', label: 'Soccer (1-10)', max: 10 },
  { key: 'football', label: 'Football (1-10)', max: 10 },
  { key: 'baseball', label: 'Baseball (1-10)', max: 10 },
  { key: 'golf', label: 'Golf Handicap', max: 54 },
  { key: 'swimming', label: 'Swimming (1-10)', max: 10 },
  { key: 'running', label: 'Running (1-10)', max: 10 },
];

export default function SettingsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [bio, setBio] = useState('');
  const [sportRatings, setSportRatings] = useState<Record<string, number>>({});
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

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
        setBio(profileData.bio || '');
        setSportRatings(profileData.sportRatings || {});
        
        if (profileData.location) {
          setLocationEnabled(true);
          setCurrentLocation(profileData.location.formattedAddress || 
            `${profileData.location.city}, ${profileData.location.state}`);
        }
      }
    });
    
    return unsubscribe;
  }, [user?.uid]);

  const handleSportRatingChange = (sport: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setSportRatings(prev => ({
        ...prev,
        [sport]: numValue
      }));
    } else if (value === '') {
      setSportRatings(prev => {
        const newRatings = { ...prev };
        delete newRatings[sport];
        return newRatings;
      });
    }
  };

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to use this feature');
        setGettingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      
      // Reverse geocode to get address
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      
      if (reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const formattedAddress = `${address.city}, ${address.region}, ${address.country}`;
        setCurrentLocation(formattedAddress);
        setLocationEnabled(true);
        
        // Update sport ratings to include location
        setSportRatings(prev => ({
          ...prev,
          location: {
            city: address.city || '',
            state: address.region || '',
            country: address.country || '',
            latitude,
            longitude,
            formattedAddress,
          }
        }));
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get current location');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      const updateData: any = {
        bio: bio.trim(),
        sportRatings: sportRatings,
      };

      // Add location if enabled
      if (locationEnabled && sportRatings.location) {
        updateData.location = sportRatings.location;
      } else if (!locationEnabled) {
        updateData.location = null;
      }

      const userDocRef = doc(db, userDoc(user.uid));
      
      try {
        await updateDoc(userDocRef, updateData);
      } catch (error: any) {
        if (error.code === 'not-found') {
          await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Unknown User',
            followersCount: 0,
            followingCount: 0,
            postsCount: 0,
            followers: [],
            following: [],
            likedPosts: [],
            createdAt: new Date(),
            ...updateData,
          });
        } else {
          throw error;
        }
      }
      
      Alert.alert('Success', 'Settings saved successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        >
          <Text style={[styles.saveButtonText, saving && styles.saveButtonTextDisabled]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <TextInput
            style={styles.bioInput}
            placeholder="Write something about yourself..."
            placeholderTextColor={COLORS.gray}
            multiline
            value={bio}
            onChangeText={setBio}
            maxLength={150}
          />
          <Text style={styles.charCount}>{bio.length}/150</Text>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Switch
              value={locationEnabled}
              onValueChange={setLocationEnabled}
              trackColor={{ false: '#E5E5E5', true: COLORS.primary }}
              thumbColor={locationEnabled ? COLORS.white : '#F4F3F4'}
            />
          </View>
          
          {locationEnabled && (
            <>
              <Text style={styles.sectionDescription}>
                Share your location for distance-based recommendations
              </Text>
              
              <TouchableOpacity
                onPress={getCurrentLocation}
                disabled={gettingLocation}
                style={[styles.locationButton, gettingLocation && styles.locationButtonDisabled]}
              >
                <Ionicons 
                  name="location-outline" 
                  size={20} 
                  color={gettingLocation ? COLORS.gray : COLORS.primary} 
                />
                <Text style={[styles.locationButtonText, gettingLocation && { color: COLORS.gray }]}>
                  {gettingLocation ? 'Getting location...' : 'Use current location'}
                </Text>
              </TouchableOpacity>
              
              {currentLocation && (
                <View style={styles.currentLocationContainer}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.currentLocationText}>{currentLocation}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Sport Ratings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sport Ratings</Text>
          <Text style={styles.sectionDescription}>
            Rate your skill level to get better recommendations
          </Text>
          
          {SPORTS.map((sport) => (
            <View key={sport.key} style={styles.sportItem}>
              <Text style={styles.sportLabel}>{sport.label}</Text>
              <TextInput
                style={styles.sportInput}
                placeholder={`0-${sport.max}`}
                placeholderTextColor={COLORS.gray}
                value={sportRatings[sport.key]?.toString() || ''}
                onChangeText={(value) => handleSportRatingChange(sport.key, value)}
                keyboardType="numeric"
              />
            </View>
          ))}
        </View>

        {/* Danger Zone */}
        <View style={[styles.section, styles.dangerSection]}>
          <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Text>
          <TouchableOpacity style={styles.dangerButton}>
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
            <Text style={styles.dangerButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    backgroundColor: COLORS.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  saveButton: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 8,
    borderRadius: SIZES.borderRadius,
    backgroundColor: COLORS.white,
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  saveButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  content: {
    flex: 1,
    padding: SIZES.padding,
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.margin,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: SIZES.margin,
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: SIZES.margin,
  },
  bioInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: SIZES.borderRadius,
    padding: SIZES.padding,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SIZES.padding,
    borderRadius: SIZES.borderRadius,
    marginBottom: SIZES.margin,
  },
  locationButtonDisabled: {
    opacity: 0.5,
  },
  locationButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  currentLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: SIZES.padding / 2,
    borderRadius: SIZES.borderRadius,
  },
  currentLocationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#059669',
  },
  sportItem: {
    marginBottom: SIZES.margin,
  },
  sportLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: 8,
  },
  sportInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: SIZES.borderRadius,
    padding: SIZES.padding / 2,
    fontSize: 16,
  },
  dangerSection: {
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  dangerTitle: {
    color: COLORS.error,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: SIZES.padding,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  dangerButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.error,
  },
});