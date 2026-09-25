import { useEffect, useState } from "react";
import { DEFAULT_AVATAR_URL, avatarUrlOf } from "../avatar";

/*
  Ảnh Google thường bị 403 nếu thiếu referrerPolicy="no-referrer".
  Khi lỗi tải thì hạ xuống ảnh mặc định của app.
*/
export default function UserAvatar({ account, className = "profile-avatar" }) {
  const preferred = avatarUrlOf(account);
  const [src, setSrc] = useState(preferred);

  useEffect(() => {
    setSrc(preferred);
  }, [preferred]);

  return (
    <img
      className={className}
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => {
        if (src !== DEFAULT_AVATAR_URL) setSrc(DEFAULT_AVATAR_URL);
      }}
    />
  );
}
