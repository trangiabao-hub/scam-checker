import { useEffect, useState } from "react";
import { Button } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useAuth } from "../auth-context";

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const daysLeft = (iso) => {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
};

/*
  Thông báo hệ thống sắp giới hạn cho chủ shop đã xác thực.
  Dùng overlay tự viết thay vì Ant Design Modal để tránh scroll-locker
  (body width: calc(100% - scrollbar)) — thủ phạm làm UI mobile lệch phải.
*/
export default function NoticeModal({ onVerify }) {
  const { config, isVerified, isAdmin, isRestoring } = useAuth();
  const [confirmed, setConfirmed] = useState(false);

  const until = config?.noticeUntil ?? "";
  const open =
    Boolean(until) && !isRestoring && !isVerified && !isAdmin && !confirmed;

  // Khoá cuộn khi mở, không đụng width của body.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!until || !open) return null;

  const left = daysLeft(until);
  const countdown =
    left === null || left < 0
      ? ""
      : left === 0
        ? "Hôm nay là ngày cuối."
        : `Còn ${left} ngày.`;

  return (
    <div className="notice-overlay" role="dialog" aria-modal="true" aria-labelledby="notice-title">
      <div className="notice-overlay-mask" aria-hidden="true" />
      <div className="notice-overlay-panel">
        <div className="notice-modal-body">
          <div className="notice-modal-icon" aria-hidden="true">
            <LockOutlined />
          </div>

          <h2 id="notice-title">
            Hệ thống dành riêng cho chủ shop cho thuê máy ảnh tại TP HCM
          </h2>

          <p>
            Dữ liệu tố cáo do cộng đồng đóng góp nên chỉ dành cho các shop đã được
            xác thực.
          </p>
          <p>
            Từ ngày <strong>{formatDate(until)}</strong>, trang sẽ không còn mở tự
            do cho tất cả mọi người. {countdown} Gửi hồ sơ xác thực shop của bạn
            trước thời hạn để không bị gián đoạn.
          </p>

          <div className="notice-modal-actions">
            <Button
              type="primary"
              size="large"
              block
              onClick={() => {
                setConfirmed(true);
                onVerify?.();
              }}
            >
              Xác thực shop
            </Button>
            <Button size="large" block onClick={() => setConfirmed(true)}>
              Tôi đã hiểu
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
