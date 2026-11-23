import { createContext, useContext, useEffect, useState } from 'react';
import {
  fetchCurrentUserApi,
  loginUserApi,
  logoutUserApi,
  registerStudentApi,
} from '../services/authApi';

const TOKEN_STORAGE_KEY = 'smart_campus_auth_token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Verify saved JWT against GET /api/auth/me on initial load
  useEffect(() => {
    let active = true;

    async function hydrateSession() {
      if (!token) {
        if (active) {
          setUser(null);
          setAuthLoading(false);
        }
        return;
      }

      try {
        const data = await fetchCurrentUserApi(token);
        if (active) {
          setUser(data.user);
        }
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) {
          setAuthLoading(false);
        }
      }
    }

    hydrateSession();

    return () => {
      active = false;
    };
  }, [token]);

  const login = async (email, password) => {
    const data = await loginUserApi({ email, password });
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (studentData) => {
    const data = await registerStudentApi(studentData);
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    const currentToken = token;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);

    if (currentToken) {
      try {
        await logoutUserApi(currentToken);
      } catch {
        // Token is already cleared client-side
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authLoading,
        isAuthenticated: Boolean(user && token),
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
