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
}

export interface Post {
  id: string;
  text: string;
  imageUrl?: string;
  userId: string;
  userDisplayName: string;
  userProfileImageUrl?: string;
  likeCount: number;
  commentCount: number;
  likes: string[];
  createdAt: any;
}