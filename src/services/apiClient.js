// API client: SQLite (local) or Supabase-backed (production) Express API.
// Attaches the signed-in student's access token to every request.
import { getAccessToken } from './supabaseClient';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function apiFetch(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new ApiError(data?.error || text || `Request failed (${res.status})`, res.status);
  return data;
}

export async function checkBackendStatus() {
  try {
    return await apiFetch('/status');
  } catch (err) {
    console.warn('API offline, using local storage:', err.message);
    return { status: 'offline' };
  }
}

export const fetchMeApi = () => apiFetch('/me');

// AI
export const crunchBacklogWithGeminiApi = (prompt, { horizonDays, today, profile } = {}) =>
  apiFetch('/ai/crunch', { method: 'POST', body: { prompt, horizonDays, today, profile } });
export const parseTimetableWithGeminiVisionApi = (imageBase64) => apiFetch('/ai/parse-timetable', { method: 'POST', body: { imageBase64 } });
export const fetchAICoachApi = (summary) => apiFetch('/ai/coach', { method: 'POST', body: { summary } });
export const fetchAITaskCoachApi = (task, minutes, context) => apiFetch('/ai/task-coach', { method: 'POST', body: { task, minutes, context } });

export const fetchAITopicCheckApi = (subject, units) => apiFetch('/ai/topic-check', { method: 'POST', body: { subject, units } });

// Stuck list
export const fetchStuckApi = () => apiFetch('/stuck');
export const addStuckApi = (item) => apiFetch('/stuck', { method: 'POST', body: item });
export const resolveStuckApi = (id, resolved = true) => apiFetch(`/stuck/${encodeURIComponent(id)}`, { method: 'PATCH', body: { resolved } });

// Check-ins & session logs
export const fetchCheckinsApi = () => apiFetch('/checkins');
export const saveCheckinApi = (dateKey, checkin) => apiFetch(`/checkins/${dateKey}`, { method: 'PUT', body: checkin });
export const fetchSessionLogsApi = () => apiFetch('/session-logs');

// Profile / routine
export async function fetchUserHabitsApi() {
  const data = await apiFetch('/user');
  return data.userHabits;
}
export const saveUserHabitsApi = (habitsData) => apiFetch('/user', { method: 'PUT', body: habitsData });

// Fixed events
export const fetchFixedEventsApi = () => apiFetch('/fixed-events');
export const createFixedEventApi = (eventData) => apiFetch('/fixed-events', { method: 'POST', body: eventData });
export const createBatchFixedEventsApi = (events) => apiFetch('/fixed-events/batch', { method: 'POST', body: { events } });
export const deleteFixedEventApi = (id) => apiFetch(`/fixed-events/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const toggleGapStudyApi = (id) => apiFetch(`/fixed-events/${encodeURIComponent(id)}/toggle-gap`, { method: 'PATCH' });

// Tasks
export const fetchTasksApi = () => apiFetch('/tasks');
export const createTaskApi = (taskData) => apiFetch('/tasks', { method: 'POST', body: taskData });
export const createBatchTasksApi = (tasks) => apiFetch('/tasks/batch', { method: 'POST', body: { tasks } });
export const updateTaskProgressApi = (id, minutes) => apiFetch(`/tasks/${encodeURIComponent(id)}/progress`, { method: 'PATCH', body: { minutes } });
export const deleteTaskApi = (id) => apiFetch(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });

// Reviews
export const fetchReviewsApi = () => apiFetch('/reviews');
export const submitReviewApi = (reviewData) => apiFetch('/reviews', { method: 'POST', body: reviewData });

export const resetDatabaseApi = () => apiFetch('/reset-data', { method: 'POST' });
