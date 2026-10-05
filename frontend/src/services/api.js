import axios from "axios";

const TOKEN_KEY = "scholawise_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      // Token expired or invalid — clear it and send the user back to login.
      setToken(null);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Extract the friendliest message a backend response offers.
export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (error?.response?.data) {
    const data = error.response.data;
    if (typeof data.detail === "string") return data.detail;
    if (data.errors) {
      const first = Object.values(data.errors)[0];
      if (first) return Array.isArray(first) ? first[0] : String(first);
    }
  }
  if (error?.message === "Network Error") {
    return "Cannot reach the StudyFlow server. Is the backend running?";
  }
  return fallback;
}

// ---- Auth -----------------------------------------------------------------
export const authApi = {
  register: (payload) => api.post("/auth/register/", payload).then((r) => r.data),
  login: (payload) => api.post("/auth/login/", payload).then((r) => r.data),
  logout: () => api.post("/auth/logout/").then((r) => r.data),
  profile: () => api.get("/profile/").then((r) => r.data.user),
  updateProfile: (payload) => api.put("/profile/", payload).then((r) => r.data.user),
  dashboardStats: () => api.get("/dashboard/stats/").then((r) => r.data),
};

// ---- Subjects ---------------------------------------------------------------
export const subjectsApi = {
  list: () => api.get("/subjects/").then((r) => r.data.subjects),
  create: (payload) => api.post("/subjects/", payload).then((r) => r.data.subject),
  update: (id, payload) => api.put(`/subjects/${id}/`, payload).then((r) => r.data.subject),
  remove: (id) => api.delete(`/subjects/${id}/`),
};

// ---- Topics -----------------------------------------------------------------
export const topicsApi = {
  // Returns { subject, topics } — the full object is intentional so callers
  // can access both the parent subject and its topics in one request.
  list: (subjectId) => api.get(`/subjects/${subjectId}/topics/`).then((r) => r.data),
  create: (subjectId, payload) =>
    api.post(`/subjects/${subjectId}/topics/`, payload).then((r) => r.data.topic),
  update: (id, payload) => api.put(`/topics/${id}/`, payload).then((r) => r.data.topic),
  remove: (id) => api.delete(`/topics/${id}/`),
  complete: (id, completed = true) =>
    api.put(`/topics/${id}/complete/`, { completed }).then((r) => r.data),
};

// ---- Study plan ---------------------------------------------------------------
export const planApi = {
  generate: () => api.post("/study-plan/generate/").then((r) => r.data),
  today: () => api.get("/study-plan/today/").then((r) => r.data),
  calendar: (month) => api.get("/study-plan/calendar/", { params: { month } }).then((r) => r.data),
  // POST is intentional — the backend PlanExplainView and PlanSuggestionsView
  // only register a post() handler (they trigger AI computation on demand,
  // which is a side-effectful operation and must not be cached by the browser).
  explain: () => api.post("/study-plan/explain/").then((r) => r.data),
  suggestions: () => api.post("/study-plan/suggestions/").then((r) => r.data),
};
// ---- AI Assistant -----------------------------------------------------------
export const aiAssistantApi = {
  chat: (message) =>
    api.post("/ai-assistant/chat/", { message }).then((r) => r.data),
};

// ---- Sessions, progress, notifications ---------------------------------------
// Note: the backend only exposes PUT /sessions/<id>/status/ — list/create/delete
// are intentionally absent until the backend adds those routes.
export const sessionsApi = {
  setStatus: (id, status) =>
    api.put(`/sessions/${id}/status/`, { status }).then((r) => r.data.session),
};

export const progressApi = {
  get: () => api.get("/progress/").then((r) => r.data),
};

export const notificationsApi = {
  list: () => api.get("/notifications/").then((r) => r.data),
  markRead: (id) => api.put(`/notifications/${id}/read/`).then((r) => r.data),
  markAllRead: () => api.post("/notifications/read-all/").then((r) => r.data),
  clear: () => api.delete("/notifications/").then((r) => r.data),
};
