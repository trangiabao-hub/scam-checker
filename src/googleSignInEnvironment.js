/**
 * Google OAuth hay hỏng trong trình duyệt nhúng (Zalo, Facebook, Instagram…)
 * hoặc khi storage bị phân vùng. Dùng để chặn sớm + hiện hướng dẫn rõ.
 */

export const GOOGLE_LOGIN_EMBEDDED_BROWSER_HINT_VI =
  "Google không cho đăng nhập khi bạn mở link từ Zalo, Facebook hoặc trình duyệt trong app. Hãy mở trang này bằng Chrome hoặc Safari (menu ⋮ / “Mở bằng…” → trình duyệt).";

export const GOOGLE_LOGIN_STORAGE_BLOCKED_HINT_VI =
  "Trình duyệt đang chặn cookie/bộ nhớ nên Google không hoàn tất được đăng nhập. Hãy mở bằng Chrome hoặc Safari (không dùng trình duyệt trong Zalo/Facebook, tránh chế độ riêng tư), rồi thử lại.";

export function isLikelyEmbeddedBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";

  if (/; wv\)/i.test(ua)) return true;

  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|Zalo|MicroMessenger|musical_ly|TikTok|Snapchat/i.test(
    ua,
  );
}

export function resolveGoogleSignInError(error, fallback = "Đăng nhập Google thất bại.") {
  const code = error?.code;
  const raw = `${error?.message || ""} ${error?.customData?.message || ""}`;

  if (/disallowed_useragent|403:\s*disallowed/i.test(raw)) {
    return GOOGLE_LOGIN_EMBEDDED_BROWSER_HINT_VI;
  }
  if (code === "auth/popup-blocked" && isLikelyEmbeddedBrowser()) {
    return GOOGLE_LOGIN_EMBEDDED_BROWSER_HINT_VI;
  }
  if (
    code === "auth/web-storage-unsupported" ||
    code === "auth/missing-initial-state" ||
    /missing initial state/i.test(raw)
  ) {
    return isLikelyEmbeddedBrowser()
      ? GOOGLE_LOGIN_EMBEDDED_BROWSER_HINT_VI
      : GOOGLE_LOGIN_STORAGE_BLOCKED_HINT_VI;
  }
  if (code === "auth/popup-closed-by-user") {
    return "Đăng nhập đã bị hủy.";
  }
  if (code === "auth/cancelled-popup-request") {
    return fallback;
  }
  if (code === "auth/popup-blocked") {
    return "Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép popup rồi thử lại.";
  }
  return error?.message || fallback;
}
