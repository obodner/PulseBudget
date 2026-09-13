import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { BudgetCaps, Transaction } from './types';

const firebaseConfig = {
  apiKey: "AIzaSyCV1mOaxCz201Wc-RM44i9XLjFq9sgnq5w",
  authDomain: "pulsebudget-erez.firebaseapp.com",
  projectId: "pulsebudget-erez",
  storageBucket: "pulsebudget-erez.firebasestorage.app",
  messagingSenderId: "763877114426",
  appId: "1:763877114426:web:58b3da0cf60290b588ab03"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Authentication Methods
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
}

export async function signupWithEmail(email: string, pass: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuthState(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

// Firestore Transactions Methods (users/{userId}/transactions/{txId})
export function subscribeToUserTransactions(
  userId: string,
  onSuccess: (transactions: Transaction[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const userTxCol = collection(db, 'users', userId, 'transactions');

  return onSnapshot(
    userTxCol,
    (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let txDate = data.date;
        if (!txDate) {
          if (data.createdAt) {
            txDate = new Date(data.createdAt).toISOString().slice(0, 16);
          } else {
            txDate = new Date().toISOString().slice(0, 16);
          }
        }

        let createdAt = Date.now();
        if (typeof data.createdAt === 'number') {
          createdAt = data.createdAt;
        } else if (data.createdAt && typeof data.createdAt.toMillis === 'function') {
          createdAt = data.createdAt.toMillis();
        } else if (txDate) {
          const parsed = new Date(txDate).getTime();
          if (!isNaN(parsed)) createdAt = parsed;
        }

        list.push({
          id: docSnap.id,
          type: (data.type === 'income' ? 'income' : 'expense'),
          amount: Number(data.amount) || 0,
          category: data.category || (data.type === 'income' ? 'other_inc' : 'other_exp'),
          date: txDate,
          note: data.note || undefined,
          receiptUrl: data.receiptUrl || undefined,
          createdAt
        });
      });

      // Sort descending by date / createdAt in JavaScript
      list.sort((a, b) => {
        const timeB = b.createdAt || new Date(b.date).getTime() || 0;
        const timeA = a.createdAt || new Date(a.date).getTime() || 0;
        return timeB - timeA;
      });

      onSuccess(list);
    },
    (err) => {
      console.error('Firestore subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveUserTransactionToFirestore(userId: string, tx: Transaction): Promise<void> {
  const txDocRef = doc(db, 'users', userId, 'transactions', tx.id);
  await setDoc(txDocRef, {
    type: tx.type,
    amount: tx.amount,
    category: tx.category,
    date: tx.date,
    note: tx.note || null,
    receiptUrl: tx.receiptUrl || null,
    createdAt: tx.createdAt
  });
}

export async function deleteUserTransactionFromFirestore(userId: string, txId: string): Promise<void> {
  const txDocRef = doc(db, 'users', userId, 'transactions', txId);
  await deleteDoc(txDocRef);
}

// Firestore User Budget Caps (users/{userId}/settings/budget)
export async function saveUserCapsToFirestore(userId: string, caps: BudgetCaps): Promise<void> {
  const capsDocRef = doc(db, 'users', userId, 'settings', 'budget');
  await setDoc(capsDocRef, {
    daily: caps.daily,
    weekly: caps.weekly,
    monthly: caps.monthly,
    categoryCaps: caps.categoryCaps || {},
    configured: true
  }, { merge: true });
}

export async function loadUserCapsFromFirestore(userId: string): Promise<BudgetCaps | null> {
  try {
    const capsDocRef = doc(db, 'users', userId, 'settings', 'budget');
    const snap = await getDoc(capsDocRef);
    if (snap.exists()) {
      const d = snap.data();
      const daily = Number(d.daily) || 0;
      const weekly = Number(d.weekly) || 0;
      const monthly = Number(d.monthly) || 0;
      const categoryCaps = (d.categoryCaps as Record<string, Partial<BudgetCaps>>) || {};

      const hasAnyCap = daily > 0 || weekly > 0 || monthly > 0 ||
        Object.values(categoryCaps).some(c => (c.daily || 0) > 0 || (c.weekly || 0) > 0 || (c.monthly || 0) > 0);

      if (hasAnyCap) {
        return { daily, weekly, monthly, categoryCaps };
      }
    }
    return null;
  } catch (e) {
    console.error('Failed to load user caps from Firestore:', e);
    return null;
  }
}

// Cloud Storage Receipt Upload (Future Receipts)
export async function uploadReceipt(userId: string, file: File): Promise<string> {
  const fileRef = ref(storage, `receipts/${userId}/${Date.now()}_${file.name}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

// User Profile Name Methods
export async function updateUserProfileName(user: User, newDisplayName: string): Promise<void> {
  await updateProfile(user, { displayName: newDisplayName });
  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, { displayName: newDisplayName }, { merge: true });
  } catch (err) {
    console.warn('Could not update Firestore user profile doc:', err);
  }
}

export async function loadUserProfileNameFromFirestore(userId: string): Promise<string | null> {
  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && typeof data.displayName === 'string' && data.displayName.trim()) {
        return data.displayName.trim();
      }
    }
  } catch (err) {
    console.warn('Could not read Firestore user profile doc:', err);
  }
  return null;
}

// Custom Categories Firestore Sync
export async function saveUserCustomCategoriesToFirestore(userId: string, categories: any[]): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'customCategories');
    await setDoc(docRef, { categories }, { merge: true });
  } catch (e) {
    console.warn('Failed to save custom categories to Firestore:', e);
  }
}

export async function loadUserCustomCategoriesFromFirestore(userId: string): Promise<any[] | null> {
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'customCategories');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.categories)) {
        return data.categories;
      }
    }
  } catch (e) {
    console.warn('Failed to load custom categories from Firestore:', e);
  }
  return null;
}


