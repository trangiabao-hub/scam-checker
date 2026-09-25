import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Image, Input, Segmented, Spin } from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  ExportOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { adminListShops, adminReviewShop } from "../api";
import { useAuth } from "../auth-context";

const FILTERS = [
  { label: "Chờ duyệt", value: "PENDING" },
  { label: "Đã duyệt", value: "VERIFIED" },
  { label: "Từ chối", value: "REJECTED" },
  { label: "Tất cả", value: "ALL" },
];

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/* Hàng chờ duyệt hồ sơ, chỉ email trong scamchecker.admin-emails mở được. */
export default function AdminReview() {
  const { token } = useAuth();
  const [status, setStatus] = useState("PENDING");
  const [shops, setShops] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminListShops(token, status);
      setShops(data?.shops ?? []);
      setStats(data?.stats ?? null);
      setError("");
    } catch (e) {
      setError(e.message || "Không tải được danh sách hồ sơ.");
    } finally {
      setIsLoading(false);
    }
  }, [token, status]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (shop, approve) => {
    setError("");
    setBusyId(shop.id);
    try {
      await adminReviewShop(token, shop.id, { approve, note: notes[shop.id] ?? "" });
      setNotes((prev) => ({ ...prev, [shop.id]: "" }));
      await load();
    } catch (e) {
      setError(e.message || "Thao tác thất bại.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="admin-head">
        <Segmented
          value={status}
          onChange={setStatus}
          options={FILTERS}
          block
        />
        {stats && (
          <div className="page-head-meta" style={{ marginTop: 14 }}>
            <strong>{stats.pending}</strong>
            <span>chờ duyệt, {stats.verified} đã duyệt, {stats.rejected} từ chối</span>
          </div>
        )}
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          closable
          onClose={() => setError("")}
          style={{ marginBottom: 16 }}
        />
      )}

      {isLoading ? (
        <div style={{ padding: "48px 0", textAlign: "center" }}>
          <Spin />
        </div>
      ) : shops.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <InboxOutlined />
          </div>
          <h2>Không có hồ sơ nào</h2>
          <p>Chưa có shop nào ở trạng thái này.</p>
        </div>
      ) : (
        <div className="card-grid">
          {shops.map((shop) => (
            <article className="report-card" key={shop.id}>
              <div className="report-card-top">
                <div style={{ minWidth: 0 }}>
                  <h3 className="report-card-name">{shop.shopName}</h3>
                  <div className="report-card-date">{formatDate(shop.createdAt)}</div>
                </div>
                <span className={`shop-badge shop-badge-${shop.status?.toLowerCase()}`}>
                  {shop.status === "PENDING"
                    ? "Chờ duyệt"
                    : shop.status === "VERIFIED"
                      ? "Đã duyệt"
                      : "Từ chối"}
                </span>
              </div>

              <div className="field-grid">
                <div>
                  <span className="field-label">Chủ shop</span>
                  <span className="field-value">{shop.owner?.fullName || "Không rõ"}</span>
                </div>
                <div>
                  <span className="field-label">Số điện thoại</span>
                  <span className="field-value num">{shop.owner?.phone || "Không có"}</span>
                </div>
                <div>
                  <span className="field-label">Email</span>
                  <span className="field-value">{shop.owner?.email}</span>
                </div>
                <div>
                  <span className="field-label">Khu vực</span>
                  <span className="field-value">{shop.district || "Không có"}</span>
                </div>
              </div>

              <div className="report-card-foot">
                <a
                  className="page-link"
                  href={shop.pageUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Mở page để đối chiếu <ExportOutlined />
                </a>

                {shop.proofImageUrl && (
                  <div style={{ marginTop: 12 }}>
                    <Image
                      src={shop.proofImageUrl}
                      alt={`Ảnh chứng minh quản lý page của ${shop.shopName}`}
                      width={200}
                    />
                  </div>
                )}

                {shop.status === "PENDING" ? (
                  <div className="review-actions">
                    <Input
                      value={notes[shop.id] ?? ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [shop.id]: e.target.value }))
                      }
                      placeholder="Lý do từ chối, bắt buộc khi từ chối"
                    />
                    <div className="review-buttons">
                      <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        loading={busyId === shop.id}
                        onClick={() => review(shop, true)}
                      >
                        Duyệt
                      </Button>
                      <Button
                        danger
                        icon={<CloseOutlined />}
                        loading={busyId === shop.id}
                        onClick={() => review(shop, false)}
                      >
                        Từ chối
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="hint" style={{ marginTop: 12 }}>
                    {shop.reviewedBy} xử lý lúc {formatDate(shop.reviewedAt)}
                    {shop.reviewNote ? `. Ghi chú: ${shop.reviewNote}` : ""}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
