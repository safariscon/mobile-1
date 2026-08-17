import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL, getApiOrigin } from '../config/api';

const REALTIME_EVENTS = [
  'catalog:changed',
  'hotel:changed',
  'service:changed',
  'room:changed',
  'booking:changed',
  'notification:new',
];

let socket = null;
const listeners = new Set();
let joinedRooms = [];

function notify(event, payload) {
  listeners.forEach((listener) => {
    try {
      listener(event, payload);
    } catch (_error) {
      // Ignore listener failures so one screen cannot break others.
    }
  });
}

export function connectRealtime(origin = getApiOrigin(API_BASE_URL)) {
  if (socket) return socket;
  socket = io(origin, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
  });
  REALTIME_EVENTS.forEach((event) => {
    socket.on(event, (payload) => notify(event, payload));
  });
  socket.on('connect', () => {
    joinedRooms.forEach((room) => socket.emit(`${room.type}:join`, room.id));
  });
  return socket;
}

export function joinRealtimeRooms(rooms = []) {
  joinedRooms = Array.isArray(rooms) ? rooms.filter((room) => room?.type && room?.id) : [];
  if (!socket) return;
  joinedRooms.forEach((room) => socket.emit(`${room.type}:join`, room.id));
}

export function leaveRealtimeRooms(rooms = joinedRooms) {
  if (socket) {
    rooms.forEach((room) => socket.emit(`${room.type}:leave`, room.id));
  }
  joinedRooms = [];
}

export function disconnectRealtime() {
  leaveRealtimeRooms();
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
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

export function useRealtimeRefresh({ enabled = true, rooms, events, onRefresh }) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || typeof refreshRef.current !== 'function') return undefined;
    connectRealtime();
    if (rooms?.length) joinRealtimeRooms(rooms);
    const listener = (event) => {
      if (events?.length && !events.includes(event)) return;
      refreshRef.current?.();
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [enabled, JSON.stringify(rooms || []), JSON.stringify(events || [])]);
}
