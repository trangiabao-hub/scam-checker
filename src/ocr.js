import { createWorker, PSM } from "tesseract.js";

let workerPromise = null;

const getWorker = async () => {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker(["vie", "eng"], 1, {
        workerPath:
          "https://unpkg.com/tesseract.js@v5.1.1/dist/worker.min.js",
        corePath:
          "https://unpkg.com/tesseract.js-core@v5.1.1/tesseract-core-simd.wasm.js",
        // Sử dụng tessdata_fast của Tesseract qua jsDelivr — file .traineddata
        // không nén (gzip: false), URL ổn định, vie ~3.8MB.
        langPath:
          "https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@main",
        gzip: false,
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: "1",
      });
      return worker;
    })();
  }
  return workerPromise;
};

const loadImage = (source) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) =>
      reject(err instanceof Error ? err : new Error("Không đọc được ảnh."));
    img.src = source;
  });

const fileToObjectUrl = (file) =>
  typeof file === "string" ? file : URL.createObjectURL(file);

const preprocessImage = async (file) => {
  const url = fileToObjectUrl(file);
  try {
    const img = await loadImage(url);
    // Upscale mạnh hơn (lên 2400px) để CCCD nhỏ trong ảnh lớn dễ đọc.
    const maxSide = 2400;
    const scale = Math.max(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return url;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    const data = ctx.getImageData(0, 0, w, h);
    const pixels = data.data;
    // Pass 1: grayscale + tính histogram cho Otsu threshold thông minh.
    const hist = new Uint32Array(256);
    const grays = new Uint8ClampedArray(pixels.length / 4);
    for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
      const g = Math.round(
        0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2],
      );
      grays[j] = g;
      hist[g]++;
    }
    const total = grays.length;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0;
    let wB = 0;
    let maxVar = 0;
    let threshold = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) {
        maxVar = between;
        threshold = t;
      }
    }
    // Pass 2: nâng tương phản mềm quanh ngưỡng Otsu (vừa giữ chữ sắc nét vừa không
    // làm mất nét nhỏ như dấu tiếng Việt).
    const contrast = 1.45;
    for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
      let v = grays[j];
      v = (v - threshold) * contrast + threshold;
      v = Math.max(0, Math.min(255, v));
      pixels[i] = v;
      pixels[i + 1] = v;
      pixels[i + 2] = v;
    }
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return url;
  }
};

const normalizeDiacritics = (value) =>
  String(value ?? "")
    .normalize("NFC")
    .replace(/[ \t]+/g, " ")
    .trim();

const stripPunct = (value) =>
  String(value ?? "")
    .replace(/[^\p{L}\p{N}\s/]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const isLikelyName = (line) => {
  if (!line) return false;
  if (/[0-9]/.test(line)) return false;
  if (line.length < 5 || line.length > 60) return false;
  const letters = line.replace(/[^\p{L}]/gu, "");
  if (!letters) return false;
  const uppers = letters.replace(/[^\p{Lu}]/gu, "");
  return uppers.length / letters.length > 0.55;
};

const looksLikeDate = (value) =>
  /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/.test(value);

const findFirstDate = (value) => {
  const match = String(value ?? "").match(
    /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/,
  );
  if (!match) return "";
  const [, d, m, y] = match;
  const year = y.length === 2 ? `19${y}` : y;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${year}`;
};

const extractCccdNumber = (text) => {
  const raw = String(text ?? "");
  // 1. Bỏ mọi dấu tách thường thấy (space/chấm/gạch/phẩy) rồi tìm 12 chữ số liên tục.
  const compact = raw.replace(/[\s.\-_,/]/g, "");
  const m12 = compact.match(/\d{12}/);
  if (m12) return m12[0];
  // 2. Nếu OCR đọc nhầm 1 ký tự giữa các nhóm 3 số, thử ghép 4 nhóm 3-3-3-3.
  const groupMatch = raw.match(/(\d{3})\D{0,3}(\d{3})\D{0,3}(\d{3})\D{0,3}(\d{3})/);
  if (groupMatch) {
    const joined = `${groupMatch[1]}${groupMatch[2]}${groupMatch[3]}${groupMatch[4]}`;
    if (joined.length === 12) return joined;
  }
  // 3. Fallback: tìm chuỗi số dài nhất, miễn ≥ 9 số.
  const allNums = compact.match(/\d{9,12}/g);
  if (allNums?.length) {
    return allNums.sort((a, b) => b.length - a.length)[0];
  }
  return "";
};

const extractGender = (text) => {
  const m = String(text ?? "").match(
    /\b(N\s*[uưữúụù]?|N[aă]m|Male|Female)\b/iu,
  );
  if (!m) return "";
  const v = m[1].toLowerCase().replace(/\s+/g, "");
  if (v.startsWith("nam") || v === "male") return "Nam";
  if (v.startsWith("n") || v === "female") return "Nữ";
  return "";
};

const extractNationality = (text) => {
  const m = String(text ?? "").match(/(Vi[eệê][tỵ]\s*Nam|Vietnam|VNM)/i);
  if (!m) return "";
  return /vnm/i.test(m[1]) ? "Việt Nam" : "Việt Nam";
};

const FIELD_LABELS = {
  fullName: /(?:H[oọ]\s*(?:v[aà]\s*)?t[eêè]n|Full\s*name|Họ\s*tên)\s*[:.]?\s*/i,
  dateOfBirth: /(?:Ng[aà]y\s*sinh|Date\s*of\s*birth|Sinh\s*ng[aà]y)\s*[:.]?\s*/i,
  gender: /(?:Gi[oớ]i\s*t[ií]nh|Sex)\s*[:.]?\s*/i,
  nationality: /(?:Qu[oố]c\s*t[ịi]ch|Nationality)\s*[:.]?\s*/i,
  placeOfOrigin:
    /(?:Qu[eê]\s*qu[aá]n|Place\s*of\s*origin|Nguy[eê]n\s*qu[aá]n)\s*[:.]?\s*/i,
  placeOfResidence:
    /(?:N[oơ]i\s*th[uư][oờ]ng\s*tr[uú]|N[oơ]i\s*c[uư]\s*tr[uú]|Place\s*of\s*residence)\s*[:.]?\s*/i,
  dateOfExpiry:
    /(?:C[oó]\s*gi[aá]\s*tr[ịi]\s*đ[eế]n|Date\s*of\s*expiry|Valid\s*until)\s*[:.]?\s*/i,
};

const NEXT_LABEL_RE =
  /(?=\b(?:Ng[aà]y|Gi[oớ]i|Qu[eêoố]|Place|Date|Sex|N[oơ]i|Nationality|Full|H[oọ]\s*(?:v[aà]\s*)?t[eêè]n|C[oó]\s*gi[aá]\s*tr[ịi])\b)/i;

const extractByLabel = (text, label, { multiline = false } = {}) => {
  const idx = text.search(label);
  if (idx < 0) return "";
  const after = text.slice(idx).replace(label, "");
  let segment;
  if (multiline) {
    // Cho phép giá trị trải qua nhiều dòng cho đến khi gặp nhãn khác.
    segment = after.split(NEXT_LABEL_RE)[0];
    segment = segment.replace(/\n+/g, ", ");
  } else {
    const newline = after.indexOf("\n");
    segment = newline >= 0 ? after.slice(0, newline) : after;
    segment = segment.split(NEXT_LABEL_RE)[0];
  }
  return normalizeDiacritics(segment)
    .replace(/^[:\-–\s/]+/, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
};

const findNameNearLabel = (lines, idx) => {
  for (let i = idx + 1; i < Math.min(lines.length, idx + 4); i++) {
    const cand = stripPunct(lines[i]).toUpperCase();
    if (isLikelyName(cand)) return normalizeDiacritics(cand);
  }
  return "";
};

const parseFrontText = (rawText) => {
  const text = normalizeDiacritics(rawText);
  const lines = text
    .split(/\r?\n/)
    .map((l) => normalizeDiacritics(l))
    .filter(Boolean);

  let fullName = "";
  const nameLabelIdx = lines.findIndex((l) => FIELD_LABELS.fullName.test(l));
  if (nameLabelIdx >= 0) {
    const onSameLine = extractByLabel(lines[nameLabelIdx], FIELD_LABELS.fullName);
    if (isLikelyName(onSameLine.toUpperCase())) {
      fullName = onSameLine.toUpperCase();
    } else {
      fullName = findNameNearLabel(lines, nameLabelIdx);
    }
  }
  if (!fullName) {
    const candidate = lines
      .map((l) => stripPunct(l).toUpperCase())
      .find((l) => isLikelyName(l));
    if (candidate) fullName = candidate;
  }

  const dateOfBirthRaw = extractByLabel(text, FIELD_LABELS.dateOfBirth);
  const dateOfBirth = looksLikeDate(dateOfBirthRaw)
    ? findFirstDate(dateOfBirthRaw)
    : findFirstDate(text);

  const genderRaw = extractByLabel(text, FIELD_LABELS.gender);
  const gender = extractGender(genderRaw) || extractGender(text);

  const nationalityRaw = extractByLabel(text, FIELD_LABELS.nationality);
  const nationality = extractNationality(nationalityRaw) || extractNationality(text);

  const placeOfOrigin =
    extractByLabel(text, FIELD_LABELS.placeOfOrigin, { multiline: true }) || "";
  const placeOfResidence =
    extractByLabel(text, FIELD_LABELS.placeOfResidence, { multiline: true }) || "";
  const dateOfExpiryRaw = extractByLabel(text, FIELD_LABELS.dateOfExpiry);
  const dateOfExpiry = looksLikeDate(dateOfExpiryRaw)
    ? findFirstDate(dateOfExpiryRaw)
    : "";

  return {
    fullName: fullName.trim(),
    cccd: extractCccdNumber(text),
    dateOfBirth,
    gender,
    nationality,
    placeOfOrigin,
    placeOfResidence,
    dateOfExpiry,
  };
};

const parseMrz = (rawText) => {
  const lines = String(rawText ?? "")
    .toUpperCase()
    .replace(/[«»]/g, "<")
    .replace(/[^A-Z0-9<\n]/g, "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.includes("<") && l.length >= 24);

  if (lines.length < 3) return null;
  let l1 = "";
  let l2 = "";
  let l3 = "";
  for (let i = 0; i < lines.length - 2; i++) {
    if (lines[i].startsWith("ID")) {
      l1 = lines[i];
      l2 = lines[i + 1];
      l3 = lines[i + 2];
      break;
    }
  }
  if (!l1) {
    l1 = lines[lines.length - 3];
    l2 = lines[lines.length - 2];
    l3 = lines[lines.length - 1];
  }

  const cccdMatch = l1.match(/\d{9,12}/g);
  const cccd = cccdMatch ? cccdMatch.sort((a, b) => b.length - a.length)[0] : "";

  let dateOfBirth = "";
  let gender = "";
  let dateOfExpiry = "";
  const dobYY = l2.slice(0, 2);
  const dobMM = l2.slice(2, 4);
  const dobDD = l2.slice(4, 6);
  if (/^\d{6}$/.test(`${dobYY}${dobMM}${dobDD}`)) {
    const currentYY = Number(String(new Date().getFullYear()).slice(2));
    const year = Number(dobYY) > currentYY ? `19${dobYY}` : `20${dobYY}`;
    dateOfBirth = `${dobDD}/${dobMM}/${year}`;
  }
  const sexChar = l2[7];
  if (sexChar === "M") gender = "Nam";
  else if (sexChar === "F") gender = "Nữ";
  const expYY = l2.slice(8, 10);
  const expMM = l2.slice(10, 12);
  const expDD = l2.slice(12, 14);
  if (/^\d{6}$/.test(`${expYY}${expMM}${expDD}`)) {
    dateOfExpiry = `${expDD}/${expMM}/20${expYY}`;
  }

  const nameRaw = l3.replace(/<+$/g, "");
  const [surname = "", given = ""] = nameRaw.split("<<");
  const fullName = `${surname.replace(/</g, " ")} ${given.replace(/</g, " ")}`
    .replace(/\s+/g, " ")
    .trim();

  if (!cccd && !fullName) return null;
  return {
    cccd,
    fullName,
    dateOfBirth,
    gender,
    dateOfExpiry,
    nationality: l2.slice(15, 18).replace(/</g, "") || "",
    placeOfOrigin: "",
    placeOfResidence: "",
  };
};

const mergeResults = (...results) => {
  const out = {
    cccd: "",
    fullName: "",
    dateOfBirth: "",
    gender: "",
    nationality: "",
    placeOfOrigin: "",
    placeOfResidence: "",
    dateOfExpiry: "",
  };
  for (const r of results) {
    if (!r) continue;
    for (const key of Object.keys(out)) {
      if (!out[key] && r[key]) out[key] = r[key];
    }
  }
  return out;
};

// OCR pass thứ 2 chỉ với ký tự số: cứu trường hợp pass 1 đọc thiếu/sai chữ số
// CCCD (ví dụ mất số cuối do nhiễu ảnh hoặc do confusion với chữ).
const recognizeDigits = async (worker, image) => {
  try {
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789 ",
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    });
    const r = await worker.recognize(image, {}, { text: true });
    return r?.data?.text ?? "";
  } finally {
    await worker.setParameters({
      tessedit_char_whitelist: "",
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
    });
  }
};

export const scanCccdImage = async (file, { onProgress } = {}) => {
  const worker = await getWorker();
  const preprocessed = await preprocessImage(file);

  const result = await worker.recognize(preprocessed, {}, { text: true });
  const text = result?.data?.text ?? "";
  onProgress?.({ stage: "ocr-done", text });

  const front = parseFrontText(text);
  const mrz = parseMrz(text);
  const merged = mergeResults(mrz, front);

  // Pass 2: nếu CCCD chưa đủ 12 chữ số, thử OCR lại với chế độ chỉ-số.
  if (!merged.cccd || merged.cccd.length < 12) {
    try {
      const digitText = await recognizeDigits(worker, preprocessed);
      const cccdCandidate = extractCccdNumber(digitText);
      if (
        cccdCandidate &&
        (cccdCandidate.length === 12 ||
          cccdCandidate.length > (merged.cccd?.length || 0))
      ) {
        merged.cccd = cccdCandidate;
      }
    } catch {
      /* noop */
    }
  }

  return { ...merged, rawText: text };
};

export const terminateOcrWorker = async () => {
  if (workerPromise) {
    try {
      const worker = await workerPromise;
      await worker.terminate();
    } catch {
      /* noop */
    }
    workerPromise = null;
  }
};
