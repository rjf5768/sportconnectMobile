// src/types/navigation.ts
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';

export type RootStackParamList = {
  MainTabs: undefined;
  CreatePost: undefined;
  Settings: undefined;
  UserProfile: { userId: string; userName: string };
  FollowList: { userId: string; userName: string; type: 'followers' | 'following' };
};

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Activity: undefined;
  Profile: undefined;
};

export type AppNavigationProp = CompositeNavigationProp<
  StackNavigationProp<RootStackParamList>,
  BottomTabNavigationProp<TabParamList>
>;

export type ProfileScreenNavigationProp = CompositeNavigationProp<
  StackNavigationProp<RootStackParamList, 'UserProfile'>,
  BottomTabNavigationProp<TabParamList>
>;

export type SearchScreenNavigationProp = CompositeNavigationProp<
  StackNavigationProp<RootStackParamList, 'UserProfile'>,
  BottomTabNavigationProp<TabParamList>
>;