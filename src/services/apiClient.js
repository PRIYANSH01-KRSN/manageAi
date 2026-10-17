// Real SQLite Backend & Gemini AI API Client
const API_BASE = '/api';

export async function checkBackendStatus() {
  try {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error('Backend offline');
    return await res.json();
  } catch (err) {
    console.warn('API error, falling back:', err.message);
    return { status: 'offline', db: 'disconnected' };
  }
}

// Live Gemini 3.8 Flash Backlog Cruncher
export async function crunchBacklogWithGeminiApi(prompt) {
  const res = await fetch(`${API_BASE}/ai/crunch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText);
  }
  return await res.json();
}

// Live Gemini 3.8 Flash Vision Timetable Parser
export async function parseTimetableWithGeminiVisionApi(imageBase64) {
  const res = await fetch(`${API_BASE}/ai/parse-timetable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText);
  }
  return await res.json();
}

export async function fetchUserHabitsApi() {
  const res = await fetch(`${API_BASE}/user`);
  if (!res.ok) throw new Error('Failed to fetch user habits');
  const data = await res.json();
  return data.userHabits;
}

export async function saveUserHabitsApi(habitsData) {
  const res = await fetch(`${API_BASE}/user`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(habitsData),
  });
  return await res.json();
}

export async function fetchFixedEventsApi() {
  const res = await fetch(`${API_BASE}/fixed-events`);
  if (!res.ok) throw new Error('Failed to fetch fixed events');
  return await res.json();
}

export async function createFixedEventApi(eventData) {
  const res = await fetch(`${API_BASE}/fixed-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData),
  });
  return await res.json();
}

export async function deleteFixedEventApi(id) {
  const res = await fetch(`${API_BASE}/fixed-events/${id}`, {
    method: 'DELETE',
  });
  return await res.json();
}

export async function toggleGapStudyApi(id) {
  const res = await fetch(`${API_BASE}/fixed-events/${id}/toggle-gap`, {
    method: 'PATCH',
  });
  return await res.json();
}

export async function fetchTasksApi() {
  const res = await fetch(`${API_BASE}/tasks`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return await res.json();
}

export async function createTaskApi(taskData) {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });
  return await res.json();
}

export async function createBatchTasksApi(tasks) {
  const res = await fetch(`${API_BASE}/tasks/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks }),
  });
  return await res.json();
}

export async function deleteTaskApi(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'DELETE',
  });
  return await res.json();
}

export async function fetchReviewsApi() {
  const res = await fetch(`${API_BASE}/reviews`);
  if (!res.ok) throw new Error('Failed to fetch reviews');
  return await res.json();
}

export async function submitReviewApi(reviewData) {
  const res = await fetch(`${API_BASE}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reviewData),
  });
  return await res.json();
}

export async function resetDatabaseApi() {
  const res = await fetch(`${API_BASE}/reset-data`, {
    method: 'POST',
  });
  return await res.json();
}
