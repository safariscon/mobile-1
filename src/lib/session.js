export function pickAccessToken(data) {
  return data?.accessToken || data?.token || data?.access_token || '';
}

export function pickRefreshToken(data) {
  return data?.refreshToken || data?.refresh_token || '';
}

export function hasSessionTokens(data) {
  return Boolean(pickAccessToken(data) && data?.user);
}

export function isLoginOtpRequired(data = {}) {
  if (hasSessionTokens(data)) return false;
  const code = String(data.code || '').toUpperCase();
  return code === 'LOGIN_OTP_REQUIRED'
    || data.otpRequired === true
    || Boolean(data.expiresInMinutes && !pickAccessToken(data) && !data.user);
}

export function isJwtAuthError(data = {}, status) {
  const code = String(data.code || data.error || '').toUpperCase().replace(/[\s-]+/g, '_');
  const message = String(data.message || data.error || '').toLowerCase();
  if (['TOKEN_EXPIRED', 'INVALID_TOKEN', 'JWT_EXPIRED', 'JWT_MALFORMED', 'UNAUTHORIZED'].includes(code)) {
    return true;
  }
  return message.includes('token expired')
    || message.includes('invalid token')
    || message.includes('jwt expired')
    || message.includes('jwt malformed')
    || message.includes('not authenticated')
    || (status === 401 && message.includes('unauthorized') && message.includes('token'));
}

export function isAuthApiPath(path) {
  return String(path || '').startsWith('/auth/');
}

export function isPaymentApiPath(path) {
  const value = String(path || '');
  return value.startsWith('/payments/')
    || /\/pay(?:ment)?(?:-status)?(?:\/|$)/.test(value)
    || value.includes('/payment-status');
}

export function needsTermsAccepted(user) {
  if (!user) return false;
  if (user.role === 'admin') return false;
  return user.termsAccepted !== true;
}

export function isSafeInAppPath(value) {
  const path = String(value || '').trim();
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
  return true;
}

export function isPaidBooking(booking) {
  return Boolean(
    booking?.detailsUnlocked
    || booking?.providerDetailsUnlocked
    || booking?.depositPaid
    || ['deposit_paid', 'deposit-paid', 'paid', 'completed'].includes(booking?.paymentStatus)
  );
}

export function isPayableBooking(booking) {
  return ['confirmed', 'waiting-for-payment'].includes(booking?.status) || booking?.paymentStatus === 'pending';
}

export function getAmountDue(booking) {
  if (booking?.depositPaid || ['deposit_paid', 'deposit-paid', 'paid'].includes(booking?.paymentStatus)) {
    return Math.max(0, Number(booking?.remainingBalance || booking?.remainingAmount || 0));
  }
  const deposit = Number(booking?.depositAmount || 0);
  if (deposit > 0) return deposit;
  const listed = Number(booking?.totalPrice || booking?.bookingDetails?.listedPriceRwf || 0);
  const paid = Number(booking?.amountPaid || 0);
  return Math.max(0, listed - paid) || listed;
}
