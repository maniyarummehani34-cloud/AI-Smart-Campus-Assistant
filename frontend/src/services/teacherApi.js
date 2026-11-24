import { getApiBaseUrl } from '../config/apiConfig';

async function teacherRequest(endpoint, token, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}/teacher${endpoint}`, {
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

export function fetchTeacherDashboardApi(token) {
  return teacherRequest('/dashboard', token);
}

export function fetchTeacherAssignmentsApi(token) {
  return teacherRequest('/assignments', token);
}

export function fetchAssignedStudentsApi(token, assignmentId) {
  return teacherRequest(`/assignments/${assignmentId}/students`, token);
}

export function fetchTeacherExamsApi(token) {
  return teacherRequest('/exams', token);
}

export function fetchExamSubjectMarksApi(token, examSubjectId) {
  return teacherRequest(`/exam-subjects/${examSubjectId}/marks`, token);
}

export function saveTeacherMarkApi(token, payload) {
  return teacherRequest('/marks', token, { method: 'POST', body: payload });
}

export function submitExamSubjectMarksApi(token, examSubjectId) {
  return teacherRequest(`/exam-subjects/${examSubjectId}/submit`, token, {
    method: 'POST',
  });
}

export function fetchTeacherPerformanceApi(token) {
  return teacherRequest('/performance', token);
}

export function fetchTeacherTimetableApi(token) {
  return teacherRequest('/timetable', token);
}
