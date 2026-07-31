import { useEffect } from 'react';

export function useRealtimeRefresh({ enabled = true, onRefresh }) {
  useEffect(() => {
    if (!enabled || typeof onRefresh !== 'function') return undefined;
    return undefined;
  }, [enabled, onRefresh]);
}

export function realtimeUserRooms(user, { admin = false, business = false } = {}) {
  const rooms = [];
  const userId = user?._id || user?.id;
  if (userId) rooms.push({ type: 'user', id: userId });
  if (admin) rooms.push({ type: 'admin', id: 'marketplace' });
  const businessId = user?.businessId || user?.hotelId || user?.sellerId || user?.business?._id || user?.hotel?._id;
  if (business && businessId) rooms.push({ type: 'business', id: businessId });
  return rooms;
}
