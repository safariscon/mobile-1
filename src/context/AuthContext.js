import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch, setAuthTokenProvider } from '../config/api';
import i18n from '../i18n';

const TOKEN_KEY = 'safariscon.authToken';
const USER_KEY = 'safariscon.authUser';
const AuthContext = createContext();

async function parseJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {};
  }
}

function isProvider(user) {
  return ['hotel', 'supplier'].includes(user?.role);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const tokenRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);

  useEffect(() => {
    setAuthTokenProvider(() => tokenRef.current);
    return () => setAuthTokenProvider(null);
  }, []);

  const saveSession = useCallback(async (nextToken, nextUser) => {
    tokenRef.current = nextToken;
    setToken(nextToken);
    setUser(nextUser);
    await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser || null));
  }, []);

  const clearSession = useCallback(async () => {
    tokenRef.current = null;
    setUser(null);
    setToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  }, []);

  const refreshUser = useCallback(async (authToken = tokenRef.current) => {
    const activeToken = authToken || tokenRef.current;
    if (!activeToken) return { success: false, error: i18n.t('backend.noActiveSession') };

    try {
      const response = await apiFetch('/auth/me', {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });
      const data = await parseJson(response);

      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          await clearSession();
        }
        throw new Error(i18n.t('backend.sessionExpired'));
      }

      setUser(data.user);
      tokenRef.current = activeToken;
      setToken(activeToken);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user || null));
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [clearSession]);

  useEffect(() => {
    let mounted = true;

    const restore = async () => {
      try {
        const [storedToken, storedUserJson] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (storedToken && mounted) {
          tokenRef.current = storedToken;
          setToken(storedToken);
          let hasCachedUser = false;

          if (storedUserJson) {
            try {
              const storedUser = JSON.parse(storedUserJson);
              if (storedUser) {
                setUser(storedUser);
                hasCachedUser = true;
              }
            } catch (_error) {
              await SecureStore.deleteItemAsync(USER_KEY);
            }
          }

          if (hasCachedUser) {
            // Render the saved session immediately and refresh it in the
            // background instead of blocking every app launch on the network.
            refreshUser(storedToken);
          } else {
            await refreshUser(storedToken);
          }
        }
      } finally {
        if (mounted) setRestoringSession(false);
      }
    };

    restore();

    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        skipAuth: true,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(i18n.t('backend.loginFailed'));
      }

      await saveSession(data.token, data.user);
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/register', {
        method: 'POST',
        skipAuth: true,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role: 'customer',
        }),
      });
      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(i18n.t('backend.registrationFailed'));
      }

      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const completeProviderRegistration = async ({
    providerName,
    providerEmail,
    sellerId,
    generatedPassword,
    newPassword,
  }) => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/provider/complete-registration', {
        method: 'POST',
        skipAuth: true,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerName,
          providerEmail,
          sellerId,
          generatedPassword,
          newPassword,
        }),
      });
      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(i18n.t('backend.providerCompleteFailed'));
      }

      await saveSession(data.token, data.user);
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await clearSession();
  };

  const value = useMemo(() => ({
    user,
    token,
    loading,
    restoringSession,
    login,
    register,
    completeProviderRegistration,
    refreshUser,
    logout,
    isAuthenticated: !!user,
    isTourist: user?.role === 'tourist' || user?.role === 'customer',
    isSeller: isProvider(user),
    isAdmin: user?.role === 'admin',
  }), [completeProviderRegistration, loading, login, logout, refreshUser, register, restoringSession, token, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
