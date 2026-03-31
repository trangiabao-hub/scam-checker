const DEFAULT_TIMEOUT_MS = 15000;

const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();

export const hasApiConfig = Boolean(apiBaseUrl);

const buildApiUrl = (path) =>
  `${apiBaseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

const parseJsonSafely = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Phản hồi API không phải JSON hợp lệ.");
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

    const payload = await parseJsonSafely(response);
    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        `API lỗi ${response.status} ${response.statusText}`;
      throw new Error(message);
    }
    return payload;
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
