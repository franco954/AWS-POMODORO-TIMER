/**
 * API Service — authenticated fetch wrapper
 */
import { fetchAuthSession } from 'aws-amplify/auth';
import { API_BASE_URL } from '../config/aws';

const getAuthHeaders = async () => {
  const session = await fetchAuthSession();
  const token   = session.tokens?.idToken?.toString();
  return {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${token}`,
  };
};

const apiRequest = async (method, path, body = null) => {
  const headers  = await getAuthHeaders();
  const options  = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE_URL}${path}`, options);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

// ── Sessions ──────────────────────────────────────────────────────
export const createSession = (type, duration, notes = '') =>
  apiRequest('POST', '/sessions', { type, duration, notes });

export const completeSession = (sessionId, startTime, status, actualDuration) =>
  apiRequest('PUT', `/sessions/${sessionId}?startTime=${encodeURIComponent(startTime)}`, {
    status,
    actualDuration,
  });

export const getSessions = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiRequest('GET', `/sessions${qs ? `?${qs}` : ''}`);
};

// ── Stats ─────────────────────────────────────────────────────────
export const getStats = () => apiRequest('GET', '/stats');

// ── Settings ──────────────────────────────────────────────────────
export const getSettings  = ()       => apiRequest('GET', '/settings');
export const saveSettings = (body)   => apiRequest('PUT', '/settings', body);

// ── Push Subscriptions ────────────────────────────────────────────
export const savePushSubscription = (subscription) =>
  apiRequest('POST', '/push-subscription', subscription);
