const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

async function adminRequest(endpoint, token, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/admin${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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

function toQuery(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') {
      sp.set(k, String(v));
    }
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const fetchAdminDashboardApi = (token) => adminRequest('/dashboard', token);

export const fetchAdminUsersApi = (token, params = {}) => {
  const normalized = typeof params === 'string' ? { role: params } : params;
  return adminRequest(`/users${toQuery(normalized)}`, token);
};
export const createAdminUserApi = (token, payload) =>
  adminRequest('/users', token, { method: 'POST', body: payload });
export const updateAdminUserStatusApi = (token, id, status) =>
  adminRequest(`/users/${id}/status`, token, { method: 'PATCH', body: { status } });

export const fetchAdminDepartmentsApi = (token) => adminRequest('/departments', token);
export const createAdminDepartmentApi = (token, payload) =>
  adminRequest('/departments', token, { method: 'POST', body: payload });

export const fetchAdminSubjectsApi = (token) => adminRequest('/subjects', token);
export const createAdminSubjectApi = (token, payload) =>
  adminRequest('/subjects', token, { method: 'POST', body: payload });
export const updateAdminSubjectStatusApi = (token, id, status) =>
  adminRequest(`/subjects/${id}/status`, token, { method: 'PATCH', body: { status } });

export const fetchAdminAssignmentsApi = (token) => adminRequest('/assignments', token);
export const createAdminAssignmentApi = (token, payload) =>
  adminRequest('/assignments', token, { method: 'POST', body: payload });
export const deleteAdminAssignmentApi = (token, id) =>
  adminRequest(`/assignments/${id}`, token, { method: 'DELETE' });

export const fetchAdminNoticesApi = (token) => adminRequest('/notices', token);
export const createAdminNoticeApi = (token, payload) =>
  adminRequest('/notices', token, { method: 'POST', body: payload });
export const updateAdminNoticeStatusApi = (token, id, status) =>
  adminRequest(`/notices/${id}/status`, token, { method: 'PATCH', body: { status } });
export const deleteAdminNoticeApi = (token, id) =>
  adminRequest(`/notices/${id}`, token, { method: 'DELETE' });

export const fetchAdminEventsApi = (token) => adminRequest('/events', token);
export const createAdminEventApi = (token, payload) =>
  adminRequest('/events', token, { method: 'POST', body: payload });
export const updateAdminEventStatusApi = (token, id, status) =>
  adminRequest(`/events/${id}/status`, token, { method: 'PATCH', body: { status } });
export const deleteAdminEventApi = (token, id) =>
  adminRequest(`/events/${id}`, token, { method: 'DELETE' });

export const fetchAdminFacultyApi = (token) => adminRequest('/faculty', token);
export const createAdminFacultyApi = (token, payload) =>
  adminRequest('/faculty', token, { method: 'POST', body: payload });
export const deleteAdminFacultyApi = (token, id) =>
  adminRequest(`/faculty/${id}`, token, { method: 'DELETE' });

export const fetchAdminTimetableApi = (token) => adminRequest('/timetable', token);
export const createAdminTimetableApi = (token, payload) =>
  adminRequest('/timetable', token, { method: 'POST', body: payload });
export const updateAdminTimetableStatusApi = (token, id, status) =>
  adminRequest(`/timetable/${id}/status`, token, { method: 'PATCH', body: { status } });
export const deleteAdminTimetableApi = (token, id) =>
  adminRequest(`/timetable/${id}`, token, { method: 'DELETE' });

export const fetchAdminFacilitiesApi = (token) => adminRequest('/facilities', token);
export const createAdminFacilityApi = (token, payload) =>
  adminRequest('/facilities', token, { method: 'POST', body: payload });
export const updateAdminFacilityStatusApi = (token, id, status) =>
  adminRequest(`/facilities/${id}/status`, token, { method: 'PATCH', body: { status } });
export const deleteAdminFacilityApi = (token, id) =>
  adminRequest(`/facilities/${id}`, token, { method: 'DELETE' });

export const fetchAdminExamsApi = (token) => adminRequest('/exams', token);
export const createAdminExamApi = (token, payload) =>
  adminRequest('/exams', token, { method: 'POST', body: payload });
export const addAdminExamSubjectApi = (token, examId, payload) =>
  adminRequest(`/exams/${examId}/subjects`, token, { method: 'POST', body: payload });
export const updateAdminExamStatusApi = (token, id, status) =>
  adminRequest(`/exams/${id}/status`, token, { method: 'PATCH', body: { status } });
export const deleteAdminExamApi = (token, id) =>
  adminRequest(`/exams/${id}`, token, { method: 'DELETE' });

export const fetchAdminMarksSubmissionsApi = (token, params = {}) => {
  const normalized = typeof params === 'string' ? { status: params } : params;
  return adminRequest(`/marks/submissions${toQuery(normalized)}`, token);
};
export const reviewAdminMarkApi = (token, markId, action, review_notes = '') =>
  adminRequest(`/marks/${markId}/review`, token, {
    method: 'PATCH',
    body: { action, review_notes },
  });
export const approveAllExamMarksApi = (token, examId) =>
  adminRequest(`/exams/${examId}/approve-all`, token, { method: 'POST' });
export const publishExamResultsApi = (token, examId) =>
  adminRequest(`/exams/${examId}/publish-results`, token, { method: 'POST' });
export const fetchAdminResultsApi = (token, params = {}) =>
  adminRequest(`/results${toQuery(params)}`, token);

export const publishVerifiedDemoContentApi = (token, scope = 'all') =>
  adminRequest('/content/publish-verified', token, {
    method: 'POST',
    body: { scope },
  });
