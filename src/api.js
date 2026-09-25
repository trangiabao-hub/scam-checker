const DEFAULT_TIMEOUT_MS = 15000;

const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();

export const hasApiConfig = Boolean(apiBaseUrl);

const buildApiUrl = (path) =>
  `${apiBaseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

/*
  Trả về { json, text }. Không ném lỗi khi body không phải JSON, vì backend trả
  lỗi 401 dưới dạng text thuần còn lỗi 400 lại là JSON có khoá message.
*/
const parseBody = async (response) => {
  const text = await response.text();
  if (!text) return { json: null, text: "" };
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
};

const withTimeout = async (requestPromise, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await requestPromise(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const request = async (path, options = {}) => {
  if (!hasApiConfig) {
    throw new Error("Chưa cấu hình VITE_API_BASE_URL.");
  }

  return withTimeout(async (signal) => {
    const response = await fetch(buildApiUrl(path), {
      ...options,
      signal,
    });

    const { json, text } = await parseBody(response);
    if (!response.ok) {
      const message =
        json?.message ||
        json?.error ||
        (text && text.length < 300 ? text : "") ||
        `API lỗi ${response.status} ${response.statusText}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return json;
  });
};

const extractArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const extractUploadUrl = (payload) =>
  payload?.url ??
  payload?.publicUrl ??
  payload?.data?.url ??
  payload?.data?.publicUrl ??
  payload?.fileUrl ??
  "";

export const fetchReports = async () => {
  const payload = await request("/public/scam-reports", { method: "GET" });
  return extractArray(payload);
};

export const createReport = async (reportPayload) => {
  return request("/public/scam-reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(reportPayload),
  });
};

export const uploadEvidenceFile = async ({ file, cccd }) => {
  const formData = new FormData();
  formData.append("file", file);
  if (cccd) formData.append("cccd", cccd);

  const payload = await request("/public/scam-reports/upload", {
    method: "POST",
    body: formData,
  });

  const fileUrl = extractUploadUrl(payload);
  if (!fileUrl) {
    throw new Error("API upload không trả về URL ảnh.");
  }
  return fileUrl;
};

/* ── Xác thực chủ shop ─────────────────────────────────────── */

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });
const jsonHeaders = (token) => ({
  "Content-Type": "application/json",
  ...(token ? authHeaders(token) : {}),
});

export const fetchScamConfig = () => request("/scam-auth/config", { method: "GET" });

export const loginWithGoogleIdToken = (body) =>
  request("/scam-auth/google", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });

export const fetchMe = (token) =>
  request("/scam-auth/me", { method: "GET", headers: authHeaders(token) });

export const registerShop = (token, payload) =>
  request("/scam-auth/register", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });

export const updateProfile = (token, payload) =>
  request("/scam-auth/profile", {
    method: "PUT",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });

export const updateShop = (token, payload) =>
  request("/scam-auth/shop", {
    method: "PUT",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });

export const uploadShopProof = async (token, file) => {
  const formData = new FormData();
  formData.append("file", file);
  const payload = await request("/scam-auth/upload-proof", {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
  const url = payload?.url ?? "";
  if (!url) throw new Error("Tải ảnh thất bại, API không trả về URL.");
  return url;
};

export const listMembers = (token) =>
  request("/scam-auth/members", { method: "GET", headers: authHeaders(token) });

export const addMember = (token, payload) =>
  request("/scam-auth/members", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });

export const removeMember = (token, id) =>
  request(`/scam-auth/members/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

export const adminListShops = (token, status) =>
  request(`/scam-admin/shops${status ? `?status=${encodeURIComponent(status)}` : ""}`, {
    method: "GET",
    headers: authHeaders(token),
  });

export const adminReviewShop = (token, id, payload) =>
  request(`/scam-admin/shops/${id}/review`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
