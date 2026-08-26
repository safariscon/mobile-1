import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  apiFetch,
  setAuthTokenProvider,
  setRefreshSessionHandler,
  setSessionExpiredHandler,
  setTermsRequiredHandler,
} from '../config/api';
import i18n from '../i18n';
import { connectRealtime, disconnectRealtime, joinRealtimeRooms, realtimeUserRooms } from '../lib/realtime';
import {
  hasSessionTokens,
  isLoginOtpRequired,
  needsTermsAccepted,
  pickAccessToken,
  pickRefreshToken,
} from '../lib/session';

const TOKEN_KEY = 'safariscon.authToken';
const REFRESH_KEY = 'safariscon.refreshToken';
const USER_KEY = 'safariscon.authUser';
const AuthContext = createContext();

async function parseJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {};
  }
}

function backendError(response, data, fallback) {
  const error = new Error(data?.message || fallback);
  error.status = response.status;
  error.code = data?.code;
  error.data = data;
  return error;
}

function isProvider(user) {
  return ['hotel', 'supplier'].includes(user?.role);
}

function roomsForUser(user) {
  if (!user) return [];
  if (user.role === 'admin') return realtimeUserRooms(user, { admin: true });
  if (isProvider(user)) return realtimeUserRooms(user, { business: true });
  return realtimeUserRooms(user);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [forceTerms, setForceTerms] = useState(false);
  const tokenRef = useRef(null);
  const refreshTokenRef = useRef(null);
  const userRef = useRef(null);
  const refreshPromiseRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);

  const clearSession = useCallback(async () => {
    tokenRef.current = null;
    refreshTokenRef.current = null;
    userRef.current = null;
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    setForceTerms(false);
    disconnectRealtime();
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  }, []);

  const persistSessionRef = useRef(true);

  const saveSession = useCallback(async (nextToken, nextUser, nextRefreshToken, { persist } = {}) => {
    if (!nextToken || !nextUser) return;
    const shouldPersist = persist ?? persistSessionRef.current;
    persistSessionRef.current = shouldPersist;
    tokenRef.current = nextToken;
    userRef.current = nextUser;
    setToken(nextToken);
    setUser(nextUser);
    if (nextRefreshToken) {
      refreshTokenRef.current = nextRefreshToken;
      setRefreshToken(nextRefreshToken);
    }
    connectRealtime();
    joinRealtimeRooms(roomsForUser(nextUser));
    if (!shouldPersist) {
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_KEY),
        SecureStore.deleteItemAsync(USER_KEY),
      ]);
      return;
    }
    if (nextRefreshToken) {
      await SecureStore.setItemAsync(REFRESH_KEY, nextRefreshToken);
    }
    await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser || null));
  }, []);

  const applyAuthPayload = useCallback(async (data, { persist } = {}) => {
    const accessToken = pickAccessToken(data);
    const nextRefresh = pickRefreshToken(data);
    if (accessToken && data.user) {
      await saveSession(accessToken, data.user, nextRefresh, { persist: persist ?? Boolean(nextRefresh) });
    }
    return { user: data.user, token: accessToken, refreshToken: nextRefresh };
  }, [saveSession]);

  const refreshAccessToken = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const activeRefresh = refreshTokenRef.current;
    if (!activeRefresh) return false;

    refreshPromiseRef.current = (async () => {
      try {
        const response = await apiFetch('/auth/refresh', {
          method: 'POST',
          skipAuth: true,
          skipRefresh: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: activeRefresh }),
        });
        const data = await parseJson(response);
        if (!response.ok || !pickAccessToken(data)) return false;
        await saveSession(pickAccessToken(data), data.user || userRef.current, pickRefreshToken(data) || activeRefresh);
        return true;
      } catch (_error) {
        return false;
      }
    })();

    try {
      return await refreshPromiseRef.current;
    } finally {
      refreshPromiseRef.current = null;
    }
  }, [saveSession]);

  useEffect(() => {
    setAuthTokenProvider(() => tokenRef.current);
    setRefreshSessionHandler(() => refreshAccessToken());
    setSessionExpiredHandler(() => { clearSession(); });
    setTermsRequiredHandler(() => setForceTerms(true));
    return () => {
      setAuthTokenProvider(null);
      setRefreshSessionHandler(null);
      setSessionExpiredHandler(null);
      setTermsRequiredHandler(null);
    };
  }, [clearSession, refreshAccessToken]);

  const refreshUser = useCallback(async (authToken = tokenRef.current) => {
    const activeToken = authToken || tokenRef.current;
    if (!activeToken && refreshTokenRef.current) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) return { success: false, error: i18n.t('backend.sessionExpired') };
    }
    const tokenToUse = tokenRef.current || activeToken;
    if (!tokenToUse) return { success: false, error: i18n.t('backend.noActiveSession') };

    try {
      const response = await apiFetch('/auth/me', {
        skipRefresh: true,
        headers: { Authorization: `Bearer ${tokenToUse}` },
      });
      const data = await parseJson(response);

      if (!response.ok) {
        if (response.status === 401) {
          const refreshed = await refreshAccessToken();
          if (refreshed) return refreshUser(tokenRef.current);
          await clearSession();
        }
        if (response.status === 403 && data?.code === 'TERMS_NOT_ACCEPTED') {
          setForceTerms(true);
          return { success: true, user: userRef.current, termsRequired: true };
        }
        throw new Error(i18n.t('backend.sessionExpired'));
      }

      setUser(data.user);
      userRef.current = data.user;
      tokenRef.current = tokenToUse;
      setToken(tokenToUse);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user || null));
      connectRealtime();
      joinRealtimeRooms(roomsForUser(data.user));
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [clearSession, refreshAccessToken]);

  useEffect(() => {
    let mounted = true;

    const restore = async () => {
      try {
        const [storedToken, storedRefresh, storedUserJson] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(REFRESH_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (storedRefresh) {
          refreshTokenRef.current = storedRefresh;
          if (mounted) setRefreshToken(storedRefresh);
        }
        if (storedUserJson) {
          try {
            const storedUser = JSON.parse(storedUserJson);
            if (storedUser && mounted) {
              setUser(storedUser);
              userRef.current = storedUser;
            }
          } catch (_error) {
            await SecureStore.deleteItemAsync(USER_KEY);
          }
        }
        if (storedToken && mounted) {
          tokenRef.current = storedToken;
          setToken(storedToken);
        }
        if (storedRefresh) {
          const refreshed = await refreshAccessToken();
          if (!refreshed && storedToken) await refreshUser(storedToken);
        } else if (storedToken) {
          await refreshUser(storedToken);
        }
      } finally {
        if (mounted) setRestoringSession(false);
      }
    };

    restore();
    return () => { mounted = false; };
  }, [refreshAccessToken, refreshUser]);

  const login = async (email, password, rememberMe = true) => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await parseJson(response);
      if (!response.ok) throw backendError(response, data, i18n.t('backend.loginFailed'));
      if (isLoginOtpRequired(data) || !hasSessionTokens(data)) {
        persistSessionRef.current = rememberMe !== false;
        return {
          success: true,
          otpRequired: true,
          email,
          expiresInMinutes: data.expiresInMinutes,
          data,
        };
      }
      const session = await applyAuthPayload(data, { persist: rememberMe !== false });
      return { success: true, ...session };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.status, data: error.data };
    } finally {
      setLoading(false);
    }
  };

  const verifyLoginOtp = async (email, otp) => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/login/verify-otp', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await parseJson(response);
      if (!response.ok) throw backendError(response, data, i18n.t('backend.loginFailed'));
      const session = await applyAuthPayload(data);
      return { success: true, ...session };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.status, data: error.data };
    } finally {
      setLoading(false);
    }
  };

  const resendLoginOtp = async (email) => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/login/resend-otp', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await parseJson(response);
      if (!response.ok) throw backendError(response, data, data.message || 'Could not resend login code.');
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.status, data: error.data };
    } finally {
      setLoading(false);
    }
  };

  const acceptTerms = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/accept-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptedTerms: true }),
      });
      const data = await parseJson(response);
      if (!response.ok) throw backendError(response, data, 'Could not accept terms.');
      const nextUser = data.user || { ...userRef.current, termsAccepted: true };
      await saveSession(tokenRef.current, nextUser, refreshTokenRef.current);
      setForceTerms(false);
      return { success: true, user: nextUser };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.status, data: error.data };
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
        skipRefresh: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'customer' }),
      });
      const data = await parseJson(response);
      if (!response.ok) throw backendError(response, data, i18n.t('backend.registrationFailed'));
      if (hasSessionTokens(data) && data.emailVerification?.required !== true && data.user.emailVerified !== false) {
        await applyAuthPayload(data);
      }
      return { success: true, user: data.user, token: pickAccessToken(data), emailVerification: data.emailVerification };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.status, data: error.data };
    } finally {
      setLoading(false);
    }
  };

  const registerBusiness = async (payload) => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/register-business', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseJson(response);
      if (!response.ok) throw backendError(response, data, i18n.t('backend.registrationFailed'));
      if (hasSessionTokens(data)) await applyAuthPayload(data);
      return { success: true, user: data.user, token: pickAccessToken(data), emailVerification: data.emailVerification, data };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.status, data: error.data };
    } finally {
      setLoading(false);
    }
  };

  const fetchProviderOnboarding = async (sellerId) => {
    const encoded = encodeURIComponent(sellerId);
    const paths = [`/auth/provider/onboarding?sellerId=${encoded}`, `/auth/provider/onboarding/${encoded}`];
    let lastError = null;
    for (const path of paths) {
      const response = await apiFetch(path, { skipAuth: true, skipRefresh: true, timeoutMs: 8000 });
      const data = await parseJson(response);
      if (response.ok) return { success: true, data: data.provider || data.onboarding || data };
      lastError = backendError(response, data, 'Could not load provider invite.');
      if (![404, 405].includes(response.status)) break;
    }
    return { success: false, error: lastError?.message || 'Could not load provider invite.' };
  };

  const completeProviderRegistration = async ({
    providerName,
    providerEmail,
    sellerId,
    generatedPassword,
    newPassword,
    acceptedTerms,
    payoutDetails,
  }) => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/provider/complete-registration', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName,
          providerEmail,
          sellerId,
          generatedPassword,
          newPassword,
          confirmPassword: newPassword,
          acceptedTerms: acceptedTerms === true,
          payoutDetails,
        }),
      });
      const data = await parseJson(response);
      if (!response.ok) throw backendError(response, data, i18n.t('backend.providerCompleteFailed'));
      if (hasSessionTokens(data) && data.emailVerification?.required !== true && data.user.emailVerified !== false) {
        await applyAuthPayload(data);
      }
      return { success: true, user: data.user, token: pickAccessToken(data), emailVerification: data.emailVerification };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.status, data: error.data };
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailOtp = async (email, otp) => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/email/verify-otp', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await parseJson(response);
      if (!response.ok) throw backendError(response, data, i18n.t('backend.registrationFailed'));
      if (hasSessionTokens(data)) await applyAuthPayload(data);
      return { success: true, user: data.user, token: pickAccessToken(data) };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.status, data: error.data };
    } finally {
      setLoading(false);
    }
  };

  const resendEmailOtp = async (email) => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/email/resend-verification-otp', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await parseJson(response);
      if (!response.ok) throw backendError(response, data, data.message || 'Could not resend verification code.');
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.status, data: error.data };
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email) => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await parseJson(response);
      if (!response.ok) throw backendError(response, data, data.message || 'Could not send reset code.');
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.status, data: error.data };
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email, otp, newPassword) => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/reset-password', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await parseJson(response);
      if (!response.ok) throw backendError(response, data, data.message || 'Could not reset password.');
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.status, data: error.data };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (payload) => {
    setLoading(true);
    try {
      const paths = ['/auth/profile', '/auth/me'];
      let lastError = null;
      for (const path of paths) {
        const response = await apiFetch(path, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await parseJson(response);
        if (response.ok) {
          const nextUser = data.user || { ...userRef.current, ...payload };
          await saveSession(tokenRef.current, nextUser, refreshTokenRef.current);
          return { success: true, user: nextUser };
        }
        lastError = backendError(response, data, 'Could not update profile.');
        if (![404, 405].includes(response.status)) break;
      }
      throw lastError;
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        skipRefresh: true,
        timeoutMs: 4000,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshTokenRef.current }),
      });
    } catch (_error) {
      // Always clear local session even if logout API is unreachable.
    }
    await clearSession();
  };

  const termsPending = forceTerms || needsTermsAccepted(user);

  const value = useMemo(() => ({
    user,
    token,
    refreshToken,
    loading,
    restoringSession,
    termsPending,
    login,
    verifyLoginOtp,
    resendLoginOtp,
    acceptTerms,
    register,
    registerBusiness,
    fetchProviderOnboarding,
    completeProviderRegistration,
    verifyEmailOtp,
    resendEmailOtp,
    forgotPassword,
    resetPassword,
    updateProfile,
    refreshUser,
    logout,
    isAuthenticated: !!user && !!token,
    isTourist: user?.role === 'tourist' || user?.role === 'customer',
    isSeller: isProvider(user),
    isAdmin: user?.role === 'admin',
  }), [completeProviderRegistration, forgotPassword, loading, login, logout, refreshToken, refreshUser, register, registerBusiness, resendEmailOtp, resendLoginOtp, resetPassword, restoringSession, termsPending, token, updateProfile, user, verifyEmailOtp, verifyLoginOtp, acceptTerms, fetchProviderOnboarding]);

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
