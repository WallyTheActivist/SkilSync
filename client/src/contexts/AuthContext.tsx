import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { authApi } from '../services/api';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  university?: string;
  role?: 'STUDENT' | 'EMPLOYER';
  companyName?: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    localStorage.removeItem('ss_token');
    try {
      const { data } = await authApi.getMe();
      setUser(data.data);
    } catch {
      localStorage.removeItem('ss_user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    setUser(data.data.user);
  };

  const register = async (registerData: RegisterData) => {
    const { data } = await authApi.register(registerData);
    setUser(data.data.user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear the local UI session even if the API cannot be reached.
    } finally {
      localStorage.removeItem('ss_token');
      setUser(null);
      window.location.href = '/login';
    }
  };

  const refreshUser = async () => {
    try {
      const { data } = await authApi.getMe();
      setUser(data.data);
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
