/** Ảnh đại diện mặc định khi chưa có ảnh Google. */
export const DEFAULT_AVATAR_URL = "/default-avatar.png";

export const avatarUrlOf = (account) =>
  account?.avatarUrl?.trim() || DEFAULT_AVATAR_URL;
