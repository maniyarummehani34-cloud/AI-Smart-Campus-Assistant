import { getApiBaseUrl } from '../config/apiConfig';

async function campusRequest(endpoint, token) {
  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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

export function fetchPublicHighlightsApi() {
  return campusRequest('/public/highlights');
}

export function fetchStudentDashboardApi(token) {
  return campusRequest('/dashboard', token);
}

export function fetchStudentExamsApi(token, { examType = 'all' } = {}) {
  const params = new URLSearchParams();
  if (examType && examType !== 'all') {
    params.set('exam_type', examType);
  }
  const qs = params.toString();
  return campusRequest(`/student/exams${qs ? `?${qs}` : ''}`, token);
}

export function fetchStudentResultsApi(token) {
  return campusRequest('/student/results', token);
}

export function fetchNoticesApi(token, { category = 'all' } = {}) {
  const params = new URLSearchParams();
  if (category && category !== 'all') {
    params.set('category', category);
  }
  const qs = params.toString();
  return campusRequest(`/notices${qs ? `?${qs}` : ''}`, token);
}

export function fetchEventsApi(
  token,
  { filter = 'upcoming', category = 'all', department = 'all', search = '' } = {}
) {
  const params = new URLSearchParams();
  if (filter) params.set('filter', filter);
  if (category && category !== 'all') params.set('category', category);
  if (department && department !== 'all') params.set('department', department);
  if (search && search.trim()) params.set('search', search.trim());
  const qs = params.toString();
  return campusRequest(`/events${qs ? `?${qs}` : ''}`, token);
}

export function fetchTimetableApi(token, { day = 'All' } = {}) {
  const params = new URLSearchParams();
  if (day && day !== 'All') {
    params.set('day', day);
  }
  const qs = params.toString();
  return campusRequest(`/timetable${qs ? `?${qs}` : ''}`, token);
}

export function fetchFacultyApi(token, { department = '', search = '' } = {}) {
  const params = new URLSearchParams();
  if (department && department !== 'all') {
    params.set('department', department);
  }
  if (search && search.trim()) {
    params.set('search', search.trim());
  }
  const qs = params.toString();
  return campusRequest(`/faculty${qs ? `?${qs}` : ''}`, token);
}

export function fetchFacilitiesApi(
  token,
  { category = 'all', status = 'all' } = {}
) {
  const params = new URLSearchParams();
  if (category && category !== 'all') {
    params.set('category', category);
  }
  if (status && status !== 'all') {
    params.set('status', status);
  }
  const qs = params.toString();
  return campusRequest(`/facilities${qs ? `?${qs}` : ''}`, token);
}
