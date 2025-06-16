// src/services/firestoreService.ts
import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Same paths as your web app
export const PATHS = {
  posts: 'artifacts/sportconnect/public/data/posts',
  users: 'artifacts/sportconnect/public/data/users',
};

export const createPost = async (userId: string, text: string, userDisplayName: string) => {
  try {
    await addDoc(collection(db, PATHS.posts), {
      text,
      userId,
      userDisplayName,
      userProfileImageUrl: '',
      likeCount: 0,
      commentCount: 0,
      likes: [],
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

export const getPosts = (callback: (posts: any[]) => void) => {
  const q = query(collection(db, PATHS.posts), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(posts);
  });
};