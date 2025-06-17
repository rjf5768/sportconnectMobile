// src/types/index.ts
export interface User {
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
}

export interface Post {
  id: string;
  text: string;
  imageUrl?: string;
  userId: string;
  userDisplayName: string;
  userProfileImageUrl?: string;
  userLocation?: {
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
    formattedAddress: string;
  };
  userSportRatings?: {
    tennis?: number;
    basketball?: number;
    soccer?: number;
    football?: number;
    baseball?: number;
    golf?: number;
    swimming?: number;
    running?: number;
  };
  likeCount: number;
  commentCount: number;
  likes: string[];
  createdAt: any;
  score?: number; // For recommendation scoring
  distance?: number; // For distance-based recommendations
}

export interface Comment {
  id: string;
  text: string;
  userId: string;
  userDisplayName: string;
  userProfileImageUrl?: string;
  createdAt: any;
}