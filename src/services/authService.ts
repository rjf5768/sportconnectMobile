// src/services/authService.ts
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile,
  User
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export const signUp = async (email: string, password: string, displayName: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update the user's display name
    await updateProfile(user, { displayName });
    
    // Create user document in Firestore (same structure as web app)
    await setDoc(doc(db, `artifacts/sportconnect/public/data/users/${user.uid}`), {
      uid: user.uid,
      email,
      displayName,
      bio: '',
      profileImageUrl: '',
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      followers: [],
      following: [],
      likedPosts: [],
      sportRatings: {},
      createdAt: serverTimestamp(),
    });
    
    return user;
  } catch (error) {
    throw error;
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};