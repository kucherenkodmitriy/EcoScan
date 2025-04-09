import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Auth } from '@aws-amplify/auth';
import { AuthContextType, User, UserRole } from '../types';

const defaultAuthContext: AuthContextType = {
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  login: async () => {},
  logout: async () => {},
};

export const AuthContext = createContext<AuthContextType>(defaultAuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const authUser = await Auth.currentAuthenticatedUser();
      const userGroups = authUser.signInUserSession.accessToken.payload['cognito:groups'] || [];
      const isAdmin = userGroups.includes('admin');
      
      const userData: User = {
        id: authUser.attributes.sub,
        username: authUser.username,
        email: authUser.attributes.email,
        role: isAdmin ? UserRole.ADMIN : UserRole.MEMBER,
      };
      
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const authUser = await Auth.signIn(username, password);
      await checkAuthState();
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await Auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const isAdmin = user?.role === UserRole.ADMIN;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}; 