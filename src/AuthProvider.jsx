import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { fetchMe, fetchScamConfig, loginWithGoogleIdToken } from "./api";
import { AuthContext } from "./auth-context";

const TOKEN_KEY = "scamchecker_token";

const readStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
};

const writeStoredToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Trình duyệt chặn storage thì phiên chỉ sống trong tab hiện tại.
  }
};

export default function AuthProvider({ children }) {
  const [token, setToken] = useState(readStoredToken);
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState(null);
  const [shop, setShop] = useState(null);
  const [config, setConfig] = useState(null);
  const [isRestoring, setIsRestoring] = useState(Boolean(readStoredToken()));
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState("");

  // Giữ token mới nhất cho các callback không phụ thuộc state.
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const applySession = useCallback((data) => {
    setEmail(data?.email ?? "");
    setAccount(data?.account ?? null);
    setShop(data?.shop ?? null);
  }, []);

  const clearSession = useCallback(() => {
    setToken("");
    writeStoredToken("");
    setEmail("");
    setAccount(null);
    setShop(null);
  }, []);

  useEffect(() => {
    fetchScamConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  // Khôi phục phiên từ token đã lưu. Token hết hạn thì dọn sạch để không kẹt.
  useEffect(() => {
    const stored = readStoredToken();
    if (!stored) {
      setIsRestoring(false);
      return;
    }
    let alive = true;
    fetchMe(stored)
      .then((data) => {
        if (!alive) return;
        applySession(data);
      })
      .catch(() => {
        if (!alive) return;
        clearSession();
      })
      .finally(() => {
        if (alive) setIsRestoring(false);
      });
    return () => {
      alive = false;
    };
  }, [applySession, clearSession]);

  const signIn = useCallback(async () => {
    setAuthError("");
    setIsSigningIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const data = await loginWithGoogleIdToken({
        idToken,
        fullName: result.user.displayName ?? "",
        avatarUrl: result.user.photoURL ?? "",
      });
      setToken(data.token);
      writeStoredToken(data.token);
      applySession(data);
      return data;
    } catch (error) {
      const code = error?.code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return null;
      }
      setAuthError(
        code === "auth/popup-blocked"
          ? "Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép popup rồi thử lại."
          : error?.message || "Đăng nhập Google thất bại.",
      );
      return null;
    } finally {
      setIsSigningIn(false);
    }
  }, [applySession]);

  const signOut = useCallback(async () => {
    clearSession();
    try {
      await firebaseSignOut(auth);
    } catch {
      // Đã xoá token phía app nên coi như đã đăng xuất.
    }
  }, [clearSession]);

  const refresh = useCallback(async () => {
    const current = tokenRef.current;
    if (!current) return null;
    try {
      const data = await fetchMe(current);
      applySession(data);
      return data;
    } catch (error) {
      if (error?.status === 401) clearSession();
      return null;
    }
  }, [applySession, clearSession]);

  const value = useMemo(
    () => ({
      token,
      email,
      account,
      shop,
      config,
      isRestoring,
      isSigningIn,
      authError,
      isSignedIn: Boolean(token),
      isRegistered: Boolean(account),
      isAdmin: account?.role === "ADMIN",
      isOwner: account?.role === "OWNER",
      isVerified: shop?.status === "VERIFIED",
      signIn,
      signOut,
      refresh,
      clearAuthError: () => setAuthError(""),
    }),
    [token, email, account, shop, config, isRestoring, isSigningIn, authError, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
