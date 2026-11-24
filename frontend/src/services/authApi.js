import { getApiBaseUrl } from '../config/apiConfig';

async function apiRequest(endpoint, { method = 'GET', body, token } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      'Unable to reach the Smart Campus API server. Please check your connection and try again.'
    );
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(
      data.message || `Request failed with status ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

export function registerStudentApi(payload) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: payload,
  });
}

export function loginUserApi(payload) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: payload,
  });
}

export function fetchCurrentUserApi(token) {
  return apiRequest('/auth/me', {
    method: 'GET',
    token,
  });
}

export function logoutUserApi(token) {
  return apiRequest('/auth/logout', {
    method: 'POST',
    token,
  });
}

export function verifyAdminAreaApi(token) {
  return apiRequest('/auth/admin-area', {
    method: 'GET',
    token,
  });
}
