import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../lib/api';
import type { AuthUser, UpdateProfilePayload } from '../lib/api';
import { getStoredToken, setStoredToken, clearStoredToken, getSavedUser, setSavedUser } from '../lib/api';

export type UserRole = 'student' | 'faculty' | 'hod' | 'admin';
export type { AuthUser };

interface AuthContextValue {
  user: AuthUser | null;
  login: (identifier: string, password: string, role: UserRole, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  updateProfile: (data: UpdateProfilePayload) => Promise<AuthUser>;
  setUser: (user: AuthUser | null) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Safely extracts a JWT token if present in URL query string (?token=... etc.)
 * or in hash fragment (#token=...).
 */
export function extractTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const queryToken = searchParams.get('token')
      || searchParams.get('authToken')
      || searchParams.get('auth_token')
      || searchParams.get('accessToken')
      || searchParams.get('access_token');

    if (queryToken && queryToken.trim().length > 15) {
      return queryToken.trim();
    }

    if (window.location.hash) {
      const hashStr = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hashStr);
      const hashToken = hashParams.get('token')
        || hashParams.get('authToken')
        || hashParams.get('auth_token')
        || hashParams.get('accessToken')
        || hashParams.get('access_token');

      if (hashToken && hashToken.trim().length > 15) {
        return hashToken.trim();
      }
    }
  } catch (e) {
    console.warn('Error reading URL token:', e);
  }

  return null;
}

/**
 * Removes auth token query or hash parameters from window.location without reloading the page.
 */
export function cleanTokenFromUrl(): void {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    let changed = false;
    const tokenKeys = ['token', 'authToken', 'auth_token', 'accessToken', 'access_token'];

    tokenKeys.forEach(param => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    });

    if (url.hash) {
      const hashStr = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
      const hashParams = new URLSearchParams(hashStr);
      let hashChanged = false;

      tokenKeys.forEach(param => {
        if (hashParams.has(param)) {
          hashParams.delete(param);
          hashChanged = true;
        }
      });

      if (hashChanged) {
        const remainingHash = hashParams.toString();
        url.hash = remainingHash ? `#${remainingHash}` : '';
        changed = true;
      }
    }

    if (changed) {
      const newPath = url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : '');
      window.history.replaceState({}, document.title, newPath);
    }
  } catch (e) {
    console.warn('Could not clean token from URL:', e);
  }
}

/**
 * Safely decodes user data from a JWT payload.
 */
export function decodeJwtUser(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload || !payload.role) return null;

    return {
      id: payload.id || payload.userId || '',
      userId: payload.userId || payload.id || '',
      name: payload.name || payload.email || 'User',
      email: payload.email || '',
      role: payload.role as UserRole,
      department: payload.department || '',
      rollNumber: payload.rollNumber,
      semester: payload.semester,
      avatarUrl: payload.avatarUrl,
    };
  } catch {
    return null;
  }
}

export const DEFAULT_STUDENT_USER: AuthUser = {
  id: 'stu-24B91A0720',
  userId: 'stu-24B91A0720',
  name: 'CHANDANI VIVEKANANDA',
  email: '24b91a0720@srkrec.ac.in',
  role: 'student',
  department: 'CSIT',
  rollNumber: '24B91A0720',
  semester: 6,
  avatarUrl: 'https://res.cloudinary.com/yp5l3jrg/image/upload/v1787372849/WhatsApp_Image_2026-08-22_at_09.56.42_aowavi.jpg',
};

export const DEFAULT_STUDENT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InN0dS0yNEI5MUEwNzIwIiwiZW1haWwiOiIyNGI5MWEwNzIwQHNya3JlYy5hYy5pbiIsInJvbGUiOiJzdHVkZW50IiwibmFtZSI6IkNIQU5EQU5JIFZJVkVLQU5BTkRBIiwiZGVwYXJ0bWVudCI6IkNTSVQiLCJyb2xsTnVtYmVyIjoiMjRCOTFBMDcyMCIsInNlbWVzdGVyIjo2LCJhdmF0YXJVcmwiOiJodHRwczovL3Jlcy5jbG91ZGluYXJ5LmNvbS95cDVsM2pyZy9pbWFnZS91cGxvYWQvdjE3ODczNzI4NDkvV2hhdHNBcHBfSW1hZ2VfMjAyNi0wOC0yMl9hdF8wOS41Ni40Ml9hb3dhdmkuanBnIiwiaWF0IjoxNzkyODU2Nzg3LCJleHAiOjQ5NDY0NTY3ODd9.gKnsMZ1vfV35EtBg5hFit15PQ_pcIDQoJSrfXQgFdbQ';

export function AuthProvider({ children }: { children: ReactNode }) {
  // Synchronously initialize user from incoming URL token or stored state, defaulting to student
  const [user, setUserState] = useState<AuthUser | null>(() => {
    // 1. Check if token was provided directly in the URL
    const urlToken = extractTokenFromUrl();
    if (urlToken) {
      setStoredToken(urlToken, true);
      cleanTokenFromUrl();
      const decoded = decodeJwtUser(urlToken);
      if (decoded) {
        setSavedUser(decoded);
        return decoded;
      }
    }

    // 2. Check if token already exists in localStorage
    const token = getStoredToken();
    if (!token) {
      setStoredToken(DEFAULT_STUDENT_TOKEN, true);
      setSavedUser(DEFAULT_STUDENT_USER);
      return DEFAULT_STUDENT_USER;
    }

    const saved = getSavedUser<AuthUser>();
    if (saved) return saved;

    const decoded = decodeJwtUser(token);
    if (decoded) {
      setSavedUser(decoded);
      return decoded;
    }

    return DEFAULT_STUDENT_USER;
  });

  const [isLoading, setLoading] = useState(false);

  const queryClient = useQueryClient();

  const setUser = (u: AuthUser | null) => {
    setUserState(u);
    setSavedUser(u);
  };

  // Revalidate user profile in background
  useEffect(() => {
    const urlToken = extractTokenFromUrl();
    if (urlToken && urlToken !== getStoredToken()) {
      setStoredToken(urlToken, true);
      cleanTokenFromUrl();
      const decoded = decodeJwtUser(urlToken);
      if (decoded) {
        setUserState(decoded);
        setSavedUser(decoded);
      }
    }

    const token = getStoredToken();
    if (token) {
      api.getMe()
        .then(u => {
          setUserState(u);
          setSavedUser(u);
        })
        .catch((err: any) => {
          // Only clear if token is definitively rejected as invalid/expired (401)
          const msg = String(err?.message || '').toLowerCase();
          if (msg.includes('401') || msg.includes('invalid') || msg.includes('expired') || msg.includes('no token')) {
            setStoredToken(DEFAULT_STUDENT_TOKEN, true);
            setSavedUser(DEFAULT_STUDENT_USER);
            setUserState(DEFAULT_STUDENT_USER);
          }
          // On any network error (mobile offline, slow connection, timeout) still resolve loading
          // so pages don't spin forever
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);


  const login = async (identifier: string, password: string, role: UserRole, rememberMe: boolean = true) => {
    queryClient.clear();
    const { token, user: u } = await api.login(identifier, password, role);
    setStoredToken(token, rememberMe);
    setSavedUser(u);
    setUserState(u);
  };

  const updateProfile = async (data: UpdateProfilePayload): Promise<AuthUser> => {
    const updated = await api.updateMe(data);
    setUserState(updated);
    setSavedUser(updated);
    return updated;
  };

  const logout = () => {
    queryClient.clear();
    clearStoredToken();
    setSavedUser(null);
    setUserState(null);
    api.logout().catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateProfile, setUser, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
