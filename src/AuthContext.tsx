import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, Organization, UserOrganizationMapping, UserRole } from './types';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  role: UserRole | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  createOrganization: (name: string, description: string) => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userRef);
        
        let userData: User;
        if (userDoc.exists()) {
          userData = { uid: userDoc.id, ...userDoc.data() } as User;
        } else {
          userData = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Anonymous',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || undefined,
            createdAt: serverTimestamp(),
          };
          await setDoc(userRef, userData);
        }

        setUser(userData);

        if (userData.currentOrganizationId) {
          const orgDoc = await getDoc(doc(db, 'organizations', userData.currentOrganizationId));
          if (orgDoc.exists()) {
            setOrganization({ id: orgDoc.id, ...orgDoc.data() } as Organization);
            
            const mappingRef = doc(db, 'userOrganizationMappings', `${userData.uid}_${userData.currentOrganizationId}`);
            const mappingDoc = await getDoc(mappingRef);
            if (mappingDoc.exists()) {
              setRole((mappingDoc.data() as UserOrganizationMapping).role);
            }
          } else {
            // Org might have been deleted, clear it
            await setDoc(userRef, { currentOrganizationId: null }, { merge: true });
            setOrganization(null);
            setRole(null);
          }
        } else {
          setOrganization(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setOrganization(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const createOrganization = async (name: string, description: string) => {
    if (!user) return;
    
    const batch = writeBatch(db);
    const orgRef = doc(collection(db, 'organizations'));
    const mappingRef = doc(db, 'userOrganizationMappings', `${user.uid}_${orgRef.id}`);
    const userRef = doc(db, 'users', user.uid);

    batch.set(orgRef, {
      name,
      description,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
    });

    batch.set(mappingRef, {
      userId: user.uid,
      organizationId: orgRef.id,
      role: 'owner',
      joinedAt: serverTimestamp(),
    });

    batch.update(userRef, {
      currentOrganizationId: orgRef.id
    });

    await batch.commit();
    
    // Refresh local state
    const newOrg = await getDoc(orgRef);
    setOrganization({ id: orgRef.id, ...newOrg.data() } as Organization);
    setRole('owner');
    setUser({ ...user, currentOrganizationId: orgRef.id });
  };

  const switchOrganization = async (orgId: string) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { currentOrganizationId: orgId }, { merge: true });
    
    // Refresh local state
    const orgDoc = await getDoc(doc(db, 'organizations', orgId));
    const mappingDoc = await getDoc(doc(db, 'userOrganizationMappings', `${user.uid}_${orgId}`));
    
    setOrganization({ id: orgId, ...orgDoc.data() } as Organization);
    setRole((mappingDoc.data() as UserOrganizationMapping).role);
    setUser({ ...user, currentOrganizationId: orgId });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      organization, 
      role, 
      loading, 
      login, 
      logout, 
      createOrganization,
      switchOrganization
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
