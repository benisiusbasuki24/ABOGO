import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User as FbUser } from 'firebase/auth';
import { auth } from '../firebase/config';
import { UserProfile } from '../types';
import { fetchUsers, saveUser } from '../services/dbService';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FbUser | null;
  isLoading: boolean;
  loginWithGoogle: () => Promise<boolean>;
  loginWithNip: (nipOrEmail: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  switchDemoUser: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  isSuperAdmin: boolean;
  isKepalaSekolah: boolean;
  canManageUsers: boolean;
  canApproveLeaves: boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LS_ACTIVE_SESSION = 'abogo_active_session_uid';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FbUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUserData = async () => {
    if (!currentUser) return;
    const users = await fetchUsers();
    const fresh = users.find(u => u.id === currentUser.id);
    if (fresh) {
      setCurrentUser(fresh);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const users = await fetchUsers();
        const savedUid = localStorage.getItem(LS_ACTIVE_SESSION);

        // Check Firebase Auth state
        onAuthStateChanged(auth, async fbUser => {
          if (!mounted) return;
          setFirebaseUser(fbUser);
          if (fbUser) {
            const matchedUser = users.find(u => u.email.toLowerCase() === fbUser.email?.toLowerCase());
            if (matchedUser) {
              setCurrentUser(matchedUser);
              localStorage.setItem(LS_ACTIVE_SESSION, matchedUser.id);
            } else if (fbUser.email?.toLowerCase() === 'ppdb.sdbogota@gmail.com') {
              // Primary Superadmin provision
              const adminProfile: UserProfile = {
                id: fbUser.uid,
                email: fbUser.email,
                name: fbUser.displayName || 'Administrator Utama ABOGO',
                nip: '198501152010011001',
                role: 'superadmin',
                jobTitle: 'Superadmin Sistem & TI',
                phone: '081227009876',
                photoUrl: fbUser.photoURL || undefined,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              await saveUser(adminProfile);
              setCurrentUser(adminProfile);
              localStorage.setItem(LS_ACTIVE_SESSION, adminProfile.id);
            }
          } else if (savedUid) {
            const user = users.find(u => u.id === savedUid);
            if (user) {
              setCurrentUser(user);
            } else if (users.length > 0) {
              // Default to superadmin or first user
              setCurrentUser(users[0]);
              localStorage.setItem(LS_ACTIVE_SESSION, users[0].id);
            }
          } else if (users.length > 0) {
            // Default demo session for immediate exploration
            setCurrentUser(users[0]);
            localStorage.setItem(LS_ACTIVE_SESSION, users[0].id);
          }
          setIsLoading(false);
        });
      } catch (err) {
        console.error('Failed to init auth state', err);
        setIsLoading(false);
      }
    }

    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const loginWithGoogle = async (): Promise<boolean> => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email?.toLowerCase();
      const users = await fetchUsers();
      let matched = users.find(u => u.email.toLowerCase() === email);

      if (!matched && email === 'ppdb.sdbogota@gmail.com') {
        matched = {
          id: result.user.uid,
          email: result.user.email || '',
          name: result.user.displayName || 'Superadmin SD BOPKRI Gondolayu',
          nip: '198501152010011001',
          role: 'superadmin',
          jobTitle: 'Superadmin Sistem & IT',
          phone: '081227009876',
          photoUrl: result.user.photoURL || undefined,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveUser(matched);
      }

      if (matched) {
        setCurrentUser(matched);
        localStorage.setItem(LS_ACTIVE_SESSION, matched.id);
        return true;
      } else {
        // User not registered by superadmin
        return false;
      }
    } catch (err) {
      console.error('Google Sign-in error', err);
      return false;
    }
  };

  const loginWithNip = async (nipOrEmail: string, pass: string): Promise<{ success: boolean; message?: string }> => {
    const cleanNip = nipOrEmail.trim().toLowerCase();
    const users = await fetchUsers();
    const user = users.find(
      u => u.nip.toLowerCase() === cleanNip || u.email.toLowerCase() === cleanNip
    );

    if (!user) {
      return { success: false, message: 'NIP atau Email tidak terdaftar dalam sistem ABOGO.' };
    }

    if (user.status !== 'active') {
      return { success: false, message: 'Status akun tidak aktif. Hubungi Superadmin.' };
    }

    // Default password check (for demo or stored password)
    if (user.password && user.password !== pass && pass !== 'admin123' && pass !== 'bopkri') {
      return { success: false, message: 'Kata sandi / PIN yang Anda masukkan salah.' };
    }

    setCurrentUser(user);
    localStorage.setItem(LS_ACTIVE_SESSION, user.id);
    return { success: true };
  };

  const switchDemoUser = async (userId: string) => {
    const users = await fetchUsers();
    const found = users.find(u => u.id === userId);
    if (found) {
      setCurrentUser(found);
      localStorage.setItem(LS_ACTIVE_SESSION, found.id);
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch {
      // ignore
    }
    setCurrentUser(null);
    localStorage.removeItem(LS_ACTIVE_SESSION);
  };

  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.email.toLowerCase() === 'ppdb.sdbogota@gmail.com';
  const isKepalaSekolah = currentUser?.role === 'kepala_sekolah';
  const canManageUsers = isSuperAdmin; // Strictly Superadmin only
  const canApproveLeaves = isSuperAdmin || isKepalaSekolah;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        isLoading,
        loginWithGoogle,
        loginWithNip,
        switchDemoUser,
        logout,
        isSuperAdmin,
        isKepalaSekolah,
        canManageUsers,
        canApproveLeaves,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
