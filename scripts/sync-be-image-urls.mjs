#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_UPDATE_ENDPOINT_TEMPLATE = "/public/scam-reports/:id";
const DEFAULT_UPDATE_METHODS = ["PUT"];

const readEnv = (name) => String(process.env[name] ?? "").trim();

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) continue;
    const key = trimmed.slice(0, equalIndex).trim();
    if (!key || process.env[key]) continue;
    const value = trimmed.slice(equalIndex + 1).trim();
    process.env[key] = value;
  }
};

const parseMode = () => {
  const modeIndex = process.argv.indexOf("--mode");
  return modeIndex !== -1 ? (process.argv[modeIndex + 1] || "").trim() : "";
};

const loadDefaultEnvFiles = () => {
  const cwd = process.cwd();
  const mode = parseMode();
  if (mode) {
    loadEnvFile(path.join(cwd, `.env.${mode}`));
    loadEnvFile(path.join(cwd, ".env"));
  } else {
    const envFiles = [".env", ".env.local", ".env.product", ".env.production"];
    for (const file of envFiles) {
      loadEnvFile(path.join(cwd, file));
    }
  }
};

const mustReadEnv = (name, aliases = []) => {
  const value = [name, ...aliases].map(readEnv).find(Boolean);
  if (!value) {
    const accepted = [name, ...aliases].join(", ");
    throw new Error(`Missing required env var. Accepted: ${accepted}`);
  }
  return value;
};

const optionalEnv = (name, fallback = "", aliases = []) =>
  [name, ...aliases].map(readEnv).find(Boolean) || String(fallback).trim();

const parseBooleanEnv = (value, defaultValue = false) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return defaultValue;
  return ["1", "true", "yes", "on"].includes(normalized);
};

const toUnixMs = (value) => {
  const numberValue = Number(value);
  if (Number.isFinite(numberValue) && numberValue > 0) {
    return numberValue;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const normalizeArrayField = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeEquipmentItems = (value) =>
  normalizeArrayField(value)
    .map((item) => ({
      deviceName: String(item?.deviceName ?? "").trim(),
      serialNumber: String(item?.serialNumber ?? "").trim(),
    }))
    .filter((item) => item.deviceName && item.serialNumber);

const normalizeImageUrls = (value) =>
  normalizeArrayField(value)
    .map((url) => String(url ?? "").trim())
    .filter(Boolean);

const extractReportId = (row) => {
  const rawId = row?.id ?? row?._id ?? row?.reportId ?? row?.report_id ?? "";
  const id = String(rawId ?? "").trim();
  return id || null;
};

const normalizeReport = (row) => {
  const cccd = String(row?.cccd ?? "").replace(/\D/g, "").slice(0, 12);
  const description = String(row?.description ?? "").trim();
  const createdAt = row?.created_at ?? new Date().toISOString();
  const createdAtMs = toUnixMs(row?.created_at_ms ?? createdAt);

  return {
    cccd,
    reporter_name: String(row?.reporter_name ?? "Không rõ").trim() || "Không rõ",
    phone: String(row?.phone ?? "").trim(),
    submitter_name: String(row?.submitter_name ?? "").trim(),
    submitter_phone: String(row?.submitter_phone ?? "").trim(),
    description,
    image_urls: normalizeImageUrls(row?.image_urls),
    equipment_items: normalizeEquipmentItems(row?.equipment_items),
    created_at: new Date(createdAtMs).toISOString(),
    created_at_ms: createdAtMs,
  };
};

const toUpdatePayload = (report) => ({
  cccd: report.cccd,
  reporter_name: report.reporter_name,
  phone: report.phone,
  submitter_name: report.submitter_name,
  submitter_phone: report.submitter_phone,
  description: report.description,
  image_urls: report.image_urls,
  equipment_items: report.equipment_items,
  created_at: report.created_at,
  created_at_ms: report.created_at_ms,
});

const withTimeout = async (requestPromise, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await requestPromise(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const parseResponseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const assertOk = async (response, context) => {
  if (response.ok) return;
  const body = await parseResponseBody(response);
  throw new Error(
    `${context} failed (${response.status} ${response.statusText}): ${JSON.stringify(body)}`,
  );
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

const isHttpImageUrl = (sourceUrl) => {
  try {
    const parsed = new URL(String(sourceUrl ?? ""));
    return /^https?:$/i.test(parsed.protocol);
  } catch {
    return false;
  }
};

const isBeImageUrl = ({ sourceUrl, apiBaseUrl }) => {
  try {
    const parsedSource = new URL(sourceUrl);
    if (!/^https?:$/i.test(parsedSource.protocol)) return false;
    const parsedApiBase = new URL(apiBaseUrl);
    return parsedSource.host === parsedApiBase.host;
  } catch {
    return false;
  }
};

const normalizeFileExtension = (filename = "", contentType = "") => {
  const namePart = String(filename).split("?")[0].split("#")[0];
  const rawExtension = namePart.includes(".")
    ? namePart.slice(namePart.lastIndexOf(".") + 1).toLowerCase()
    : "";
  if (rawExtension && /^[a-z0-9]{2,5}$/.test(rawExtension)) {
    return rawExtension;
  }
  const byMime = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
  };
  return byMime[String(contentType).toLowerCase()] || "jpg";
};

const buildUploadFileName = ({ sourceUrl, cccd, index, contentType }) => {
  const parsedUrl = new URL(sourceUrl);
  const rawBaseName =
    parsedUrl.pathname.split("/").filter(Boolean).pop() || `evidence-${index + 1}`;
  const safeBaseName = rawBaseName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 80);
  const extension = normalizeFileExtension(rawBaseName, contentType);
  return `${cccd || "unknown"}-${safeBaseName || `evidence-${index + 1}`}.${extension}`;
};

const cloneImageToBe = async ({ apiBaseUrl, sourceUrl, cccd, index }) => {
  const remoteResponse = await withTimeout(
    (signal) =>
      fetch(sourceUrl, {
        method: "GET",
        signal,
      }),
    DEFAULT_TIMEOUT_MS * 2,
  );
  await assertOk(remoteResponse, `Download image: ${sourceUrl}`);

  const contentType =
    String(remoteResponse.headers.get("content-type") || "").split(";")[0].trim() ||
    "application/octet-stream";
  const arrayBuffer = await remoteResponse.arrayBuffer();
  const fileName = buildUploadFileName({
    sourceUrl,
    cccd,
    index,
    contentType,
  });
  const fileBlob = new Blob([arrayBuffer], { type: contentType });

  const endpoint = `${apiBaseUrl.replace(/\/+$/, "")}/public/scam-reports/upload`;
  const formData = new FormData();
  formData.append("file", fileBlob, fileName);
  if (cccd) formData.append("cccd", cccd);

  return withTimeout(async (signal) => {
    const uploadResponse = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal,
    });
    await assertOk(uploadResponse, `Upload image to BE: ${sourceUrl}`);
    const payload = await parseResponseBody(uploadResponse);
    const uploadedUrl = extractUploadUrl(payload);
    if (!uploadedUrl) {
      throw new Error(`Upload image did not return URL: ${sourceUrl}`);
    }
    return uploadedUrl;
  });
};

const shouldRehostUrl = ({ sourceUrl, apiBaseUrl, forceRehostAll }) => {
  if (!isHttpImageUrl(sourceUrl)) return false;
  if (forceRehostAll) return true;
  return !isBeImageUrl({ sourceUrl, apiBaseUrl });
};

const rehostImagesForBeReport = async ({ apiBaseUrl, report, forceRehostAll }) => {
  if (!report.image_urls.length) return report.image_urls;
  const nextUrls = [];
  let changed = false;

  for (const [index, sourceUrl] of report.image_urls.entries()) {
    if (!shouldRehostUrl({ sourceUrl, apiBaseUrl, forceRehostAll })) {
      nextUrls.push(sourceUrl);
      continue;
    }
    const uploadedUrl = await cloneImageToBe({
      apiBaseUrl,
      sourceUrl,
      cccd: report.cccd,
      index,
    });
    nextUrls.push(uploadedUrl);
    changed = true;
  }

  return changed ? nextUrls : report.image_urls;
};

const fetchExistingBeReports = async (apiBaseUrl) => {
  const endpoint = `${apiBaseUrl.replace(/\/+$/, "")}/public/scam-reports`;
  return withTimeout(async (signal) => {
    const response = await fetch(endpoint, { method: "GET", signal });
    await assertOk(response, "Fetch BE reports");
    const payload = await parseResponseBody(response);
    return extractArray(payload).map((row) => {
      const normalized = normalizeReport(row);
      return {
        report_id: extractReportId(row),
        ...normalized,
      };
    });
  });
};

const toReportUpdateEndpoint = ({ apiBaseUrl, endpointTemplate, reportId }) => {
  const encodedId = encodeURIComponent(String(reportId ?? "").trim());
  const resolvedPath = String(endpointTemplate || DEFAULT_UPDATE_ENDPOINT_TEMPLATE)
    .replace(/:id\b/g, encodedId)
    .replace(/\{id\}/g, encodedId);
  return `${apiBaseUrl.replace(/\/+$/, "")}/${resolvedPath.replace(/^\/+/, "")}`;
};

const updateReportImagesInBe = async ({
  apiBaseUrl,
  endpointTemplate,
  updateMethods,
  reportId,
  reportPayload,
}) => {
  if (!reportId) {
    throw new Error("Missing report id for update.");
  }

  const endpoint = toReportUpdateEndpoint({
    apiBaseUrl,
    endpointTemplate,
    reportId,
  });
  const errors = [];

  for (const method of updateMethods) {
    try {
      await withTimeout(async (signal) => {
        const response = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reportPayload),
          signal,
        });
        await assertOk(response, `Update BE report image_urls by ${method}`);
      });
      return;
    } catch (error) {
      errors.push(`${method}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Could not update report ${reportId}. ${errors.join(" | ")}`);
};

const run = async () => {
  loadDefaultEnvFiles();

  const apiBaseUrl = mustReadEnv("BE_API_BASE_URL", ["VITE_API_BASE_URL"]);
  const forceRehostAll = parseBooleanEnv(optionalEnv("FORCE_REHOST_ALL_IMAGES", "false"));
  const dryRun = parseBooleanEnv(optionalEnv("DRY_RUN", "false"));
  const updateEndpointTemplate = optionalEnv(
    "BE_REPORT_UPDATE_ENDPOINT_TEMPLATE",
    DEFAULT_UPDATE_ENDPOINT_TEMPLATE,
  );
  const updateMethods = optionalEnv(
    "BE_REPORT_UPDATE_METHODS",
    DEFAULT_UPDATE_METHODS.join(","),
  )
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);

  console.log("Starting BE image URL rehost...");
  console.log(`- API base URL: ${apiBaseUrl}`);
  console.log(`- Force rehost all image URLs: ${forceRehostAll ? "enabled" : "disabled"}`);
  console.log(`- Dry run: ${dryRun ? "enabled" : "disabled"}`);
  console.log(`- Update endpoint template: ${updateEndpointTemplate}`);
  console.log(`- Update methods: ${updateMethods.join(", ") || "(none)"}`);

  const beRows = await fetchExistingBeReports(apiBaseUrl);
  console.log(`- Existing BE rows: ${beRows.length}`);

  const candidates = beRows.filter((item) =>
    item.image_urls.some((url) => shouldRehostUrl({ sourceUrl: url, apiBaseUrl, forceRehostAll })),
  );
  console.log(`- Candidate reports to update: ${candidates.length}`);

  let updatedCount = 0;
  let skippedCount = 0;
  const failedReports = [];

  for (const report of candidates) {
    try {
      const nextImageUrls = await rehostImagesForBeReport({
        apiBaseUrl,
        report,
        forceRehostAll,
      });

      const didChange = JSON.stringify(nextImageUrls) !== JSON.stringify(report.image_urls);
      if (!didChange) {
        skippedCount += 1;
        continue;
      }

      if (dryRun) {
        updatedCount += 1;
        continue;
      }

      const updatePayload = toUpdatePayload({
        ...report,
        image_urls: nextImageUrls,
      });

      await updateReportImagesInBe({
        apiBaseUrl,
        endpointTemplate: updateEndpointTemplate,
        updateMethods: updateMethods.length ? updateMethods : DEFAULT_UPDATE_METHODS,
        reportId: report.report_id,
        reportPayload: updatePayload,
      });
      updatedCount += 1;
    } catch (error) {
      failedReports.push({
        cccd: report.cccd,
        created_at_ms: report.created_at_ms,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(`Rehost finished. Updated: ${updatedCount}, skipped: ${skippedCount}`);
  if (failedReports.length) {
    console.log("Failed rows:");
    for (const item of failedReports) {
      console.log(`- ${item.cccd} @ ${item.created_at_ms}: ${item.error}`);
    }
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error("Rehost failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
