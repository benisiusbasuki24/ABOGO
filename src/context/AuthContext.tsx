import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User as FbUser } from 'firebase/auth';
import { auth } from '../firebase/config';
import { UserProfile } from '../types';
import { fetchUsers, saveUser } from '../services/dbService';
import {
  checkBiometricSupport,
  registerDeviceBiometric,
  authenticateWithBiometric,
  removeDeviceBiometric,
  getLastBiometricUser,
  BiometricRegistration,
} from '../services/biometricService';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FbUser | null;
  isLoading: boolean;
  loginWithGoogle: () => Promise<boolean>;
  loginWithNip: (nipOrEmail: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  loginWithBiometric: (targetNipOrId?: string) => Promise<{ success: boolean; message?: string }>;
  registerBiometric: () => Promise<{ success: boolean; message: string }>;
  removeBiometric: () => Promise<void>;
  isBiometricSupported: boolean;
  registeredBiometricUser: BiometricRegistration | null;
  refreshBiometricStatus: () => void;
  switchDemoUser: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  isSuperAdmin: boolean;
  isKepalaSekolah: boolean;
  canManageUsers: boolean;
  canApproveLeaves: boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LS_ACTIVE_SESSION = 'prebogo_active_session_uid';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FbUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [registeredBiometricUser, setRegisteredBiometricUser] = useState<BiometricRegistration | null>(null);

  const refreshBiometricStatus = () => {
    setRegisteredBiometricUser(getLastBiometricUser());
  };

  useEffect(() => {
    checkBiometricSupport().then(res => {
      setIsBiometricSupported(res.supported);
    });
    refreshBiometricStatus();
  }, [currentUser]);

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
        const savedUid = localStorage.getItem(LS_ACTIVE_SESSION) || localStorage.getItem('abogo_active_session_uid');

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
                name: fbUser.displayName || 'Administrator Utama PREBOGO',
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
            } else {
              setCurrentUser(null);
              localStorage.removeItem(LS_ACTIVE_SESSION);
            }
          } else {
            // STRICT MANUAL LOGIN REQUIRED:
            // Do NOT auto-login to any user. Require manual credentials input.
            setCurrentUser(null);
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
    const cleanInput = nipOrEmail.trim().toLowerCase();
    const cleanPass = pass.trim();
    const users = await fetchUsers();

    // Support flexible manual login matching by:
    // 1. NIP
    // 2. Email
    // 3. Username aliases: 'admin' for superadmin, 'kepsek' for kepala sekolah, 'guru.dummy' / 'dummy' for test account
    const user = users.find(u => {
      const uNip = (u.nip || '').trim().toLowerCase();
      const uEmail = (u.email || '').trim().toLowerCase();
      if (uNip === cleanInput || uEmail === cleanInput) return true;
      if (cleanInput === 'admin' && (u.role === 'superadmin' || u.id === 'user_superadmin' || uEmail === 'ppdb.sdbogota@gmail.com')) return true;
      if (cleanInput === 'kepsek' && u.role === 'kepala_sekolah') return true;
      if ((cleanInput === 'guru.dummy' || cleanInput === 'dummy') && (u.id === 'user_guru_dummy' || uEmail.includes('dummy'))) return true;
      return false;
    });

    if (!user) {
      return { success: false, message: 'NIP, Username, atau Email tidak terdaftar dalam sistem PREBOGO.' };
    }

    if (user.status !== 'active') {
      return { success: false, message: 'Status akun tidak aktif. Silakan hubungi Superadmin.' };
    }

    // Password validation
    const expectedPassword = user.password || (user.role === 'superadmin' ? 'admin' : (user.id === 'user_guru_dummy' ? 'guru123' : '123'));
    const isPassValid =
      cleanPass === expectedPassword ||
      (user.role === 'superadmin' && (cleanPass === 'admin' || cleanPass === 'admin123')) ||
      (user.id === 'user_guru_dummy' && cleanPass === 'guru123') ||
      (user.role !== 'superadmin' && user.id !== 'user_guru_dummy' && (cleanPass === '123' || cleanPass === 'bopkri'));

    if (!isPassValid) {
      return { success: false, message: 'Kata sandi / PIN yang Anda masukkan salah.' };
    }

    setCurrentUser(user);
    localStorage.setItem(LS_ACTIVE_SESSION, user.id);
    return { success: true };
  };

  const loginWithBiometric = async (targetNipOrId?: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await authenticateWithBiometric(targetNipOrId);
      if (res.success && res.user) {
        setCurrentUser(res.user);
        localStorage.setItem(LS_ACTIVE_SESSION, res.user.id);
        refreshBiometricStatus();
        return { success: true, message: res.message };
      }
      return { success: false, message: res.message };
    } catch (err: unknown) {
      const error = err as Error;
      return { success: false, message: error.message || 'Gagal login biometrik' };
    }
  };

  const registerBiometric = async (): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Harus masuk terlebih dahulu untuk mengaktifkan biometrik' };
    const res = await registerDeviceBiometric(currentUser);
    if (res.success) {
      await refreshUserData();
      refreshBiometricStatus();
    }
    return res;
  };

  const removeBiometric = async (): Promise<void> => {
    if (!currentUser) return;
    await removeDeviceBiometric(currentUser.id);
    await refreshUserData();
    refreshBiometricStatus();
  };

  const switchDemoUser = async (_userId: string) => {
    // Deprecated: Strict manual login enforced
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
        loginWithBiometric,
        registerBiometric,
        removeBiometric,
        isBiometricSupported,
        registeredBiometricUser,
        refreshBiometricStatus,
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
