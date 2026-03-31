#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 20000;

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

const buildUploadFileName = ({ sourceUrl, deviceId, index, contentType }) => {
  const parsedUrl = new URL(sourceUrl);
  const rawBaseName =
    parsedUrl.pathname.split("/").filter(Boolean).pop() || `device-img-${index + 1}`;
  const safeBaseName = rawBaseName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 80);
  const extension = normalizeFileExtension(rawBaseName, contentType);
  return `device-${deviceId}-${safeBaseName || `img-${index + 1}`}.${extension}`;
};

const shouldRehostUrl = ({ sourceUrl, apiBaseUrl, forceRehostAll }) => {
  if (!isHttpImageUrl(sourceUrl)) return false;
  if (forceRehostAll) return true;
  return !isBeImageUrl({ sourceUrl, apiBaseUrl });
};

const cloneImageToBe = async ({ apiBaseUrl, sourceUrl, deviceId, index }) => {
  const remoteResponse = await withTimeout(
    (signal) => fetch(sourceUrl, { method: "GET", signal }),
    DEFAULT_TIMEOUT_MS * 2,
  );
  await assertOk(remoteResponse, `Download image: ${sourceUrl}`);

  const contentType =
    String(remoteResponse.headers.get("content-type") || "").split(";")[0].trim() ||
    "application/octet-stream";
  const arrayBuffer = await remoteResponse.arrayBuffer();
  const fileName = buildUploadFileName({ sourceUrl, deviceId, index, contentType });
  const fileBlob = new Blob([arrayBuffer], { type: contentType });

  const endpoint = `${apiBaseUrl.replace(/\/+$/, "")}/v1/devices/upload`;
  const formData = new FormData();
  formData.append("file", fileBlob, fileName);
  formData.append("deviceId", String(deviceId));

  return withTimeout(async (signal) => {
    const uploadResponse = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal,
    });
    await assertOk(uploadResponse, `Upload device image to BE: ${sourceUrl}`);
    const payload = await parseResponseBody(uploadResponse);
    const uploadedUrl = extractUploadUrl(payload);
    if (!uploadedUrl) {
      throw new Error(`Upload did not return URL: ${sourceUrl}`);
    }
    return uploadedUrl;
  });
};

const fetchAllDevices = async (apiBaseUrl) => {
  const endpoint = `${apiBaseUrl.replace(/\/+$/, "")}/v1/devices`;
  return withTimeout(async (signal) => {
    const response = await fetch(endpoint, { method: "GET", signal });
    await assertOk(response, "Fetch devices");
    const payload = await parseResponseBody(response);
    return extractArray(payload).map((row) => ({
      id: row.id,
      name: String(row.name ?? "").trim(),
      images: (Array.isArray(row.images) ? row.images : [])
        .map((url) => String(url ?? "").trim())
        .filter(Boolean),
    }));
  });
};

const rehostImagesForDevice = async ({ apiBaseUrl, device, forceRehostAll }) => {
  if (!device.images.length) return device.images;
  const nextUrls = [];
  let changed = false;

  for (const [index, sourceUrl] of device.images.entries()) {
    if (!shouldRehostUrl({ sourceUrl, apiBaseUrl, forceRehostAll })) {
      nextUrls.push(sourceUrl);
      continue;
    }
    const uploadedUrl = await cloneImageToBe({
      apiBaseUrl,
      sourceUrl,
      deviceId: device.id,
      index,
    });
    nextUrls.push(uploadedUrl);
    changed = true;
  }

  return changed ? nextUrls : device.images;
};

const updateDeviceImagesInBe = async ({ apiBaseUrl, deviceId, images }) => {
  const endpoint = `${apiBaseUrl.replace(/\/+$/, "")}/v1/devices/${encodeURIComponent(deviceId)}/images`;
  await withTimeout(async (signal) => {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
      signal,
    });
    await assertOk(response, `Update device ${deviceId} images`);
  });
};

const run = async () => {
  loadDefaultEnvFiles();

  const apiBaseUrl = mustReadEnv("BE_API_BASE_URL", ["VITE_API_BASE_URL"]);
  const forceRehostAll = parseBooleanEnv(optionalEnv("FORCE_REHOST_ALL_IMAGES", "false"));
  const dryRun = parseBooleanEnv(optionalEnv("DRY_RUN", "false"));

  console.log("Starting device image URL rehost...");
  console.log(`- API base URL: ${apiBaseUrl}`);
  console.log(`- Force rehost all: ${forceRehostAll ? "enabled" : "disabled"}`);
  console.log(`- Dry run: ${dryRun ? "enabled" : "disabled"}`);

  const devices = await fetchAllDevices(apiBaseUrl);
  console.log(`- Total devices: ${devices.length}`);

  const candidates = devices.filter((d) =>
    d.images.some((url) => shouldRehostUrl({ sourceUrl: url, apiBaseUrl, forceRehostAll })),
  );
  console.log(`- Devices with images to rehost: ${candidates.length}`);

  let updatedCount = 0;
  let skippedCount = 0;
  const failedDevices = [];

  for (const device of candidates) {
    try {
      const nextImages = await rehostImagesForDevice({
        apiBaseUrl,
        device,
        forceRehostAll,
      });

      const didChange = JSON.stringify(nextImages) !== JSON.stringify(device.images);
      if (!didChange) {
        skippedCount += 1;
        continue;
      }

      if (dryRun) {
        console.log(`[DRY RUN] Device ${device.id} (${device.name}): ${nextImages.length} images`);
        updatedCount += 1;
        continue;
      }

      await updateDeviceImagesInBe({
        apiBaseUrl,
        deviceId: device.id,
        images: nextImages,
      });
      console.log(`Updated device ${device.id} (${device.name}): ${nextImages.length} images`);
      updatedCount += 1;
    } catch (error) {
      failedDevices.push({
        id: device.id,
        name: device.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(`\nRehost finished. Updated: ${updatedCount}, skipped: ${skippedCount}`);
  if (failedDevices.length) {
    console.log("Failed devices:");
    for (const item of failedDevices) {
      console.log(`- Device ${item.id} (${item.name}): ${item.error}`);
    }
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error("Device rehost failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
