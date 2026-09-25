import { useEffect, useState } from "react";
import { Alert, Button, Input, Select, message } from "antd";
import {
  CheckOutlined,
  EditOutlined,
  ExportOutlined,
  FacebookOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import { updateShop } from "../api";
import { useAuth } from "../auth-context";

const HCM_DISTRICTS = [
  "Quận 1", "Quận 3", "Quận 4", "Quận 5", "Quận 6", "Quận 7", "Quận 8",
  "Quận 10", "Quận 11", "Quận 12", "Bình Thạnh", "Phú Nhuận", "Tân Bình",
  "Tân Phú", "Gò Vấp", "Bình Tân", "Thủ Đức", "Bình Chánh", "Hóc Môn",
  "Nhà Bè", "Củ Chi", "Cần Giờ",
].map((d) => ({ value: d, label: d }));

const STATUS_META = {
  VERIFIED: { label: "Đã xác thực", className: "shop-badge-verified" },
  PENDING: { label: "Chờ duyệt", className: "shop-badge-pending" },
  REJECTED: { label: "Bị từ chối", className: "shop-badge-rejected" },
};

/*
  Thẻ thông tin shop. Chủ shop đã duyệt được sửa tên / khu vực / địa chỉ / page.
  Nhân viên chỉ xem.
*/
export default function ShopCard({ shop, editable = false }) {
  const { token, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    shopName: "",
    district: undefined,
    address: "",
    pageUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing && shop) {
      setForm({
        shopName: shop.shopName ?? "",
        district: shop.district || undefined,
        address: shop.address ?? "",
        pageUrl: shop.pageUrl ?? "",
      });
    }
  }, [shop, editing]);

  if (!shop) return null;

  const status = STATUS_META[shop.status] || STATUS_META.PENDING;
  const set = (key) => (e) =>
    setForm((prev) => ({
      ...prev,
      [key]: typeof e === "string" || e === undefined ? e : e.target.value,
    }));

  const startEdit = () => {
    setError("");
    setForm({
      shopName: shop.shopName ?? "",
      district: shop.district || undefined,
      address: shop.address ?? "",
      pageUrl: shop.pageUrl ?? "",
    });
    setEditing(true);
  };

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      await updateShop(token, form);
      await refresh();
      setEditing(false);
      message.success("Đã cập nhật thông tin shop.");
    } catch (e) {
      setError(e.message || "Không lưu được thông tin shop.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="surface profile-card">
      <div className="surface-head">
        <h2 className="surface-title">
          <ShopOutlined />
          {editing ? "Sửa thông tin shop" : shop.shopName}
        </h2>
        <div className="shop-head-actions">
          <span className={`shop-badge ${status.className}`}>{status.label}</span>
          {editable && !editing && (
            <Button size="small" icon={<EditOutlined />} onClick={startEdit}>
              Sửa
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="profile-edit">
          <label className="edit-field">
            <span className="field-label">Tên shop</span>
            <Input
              value={form.shopName}
              onChange={set("shopName")}
              placeholder="Tên hiển thị của shop"
              maxLength={100}
            />
          </label>
          <label className="edit-field">
            <span className="field-label">Khu vực</span>
            <Select
              value={form.district}
              onChange={set("district")}
              options={HCM_DISTRICTS}
              placeholder="Chọn quận / huyện"
              allowClear
              style={{ width: "100%" }}
            />
          </label>
          <label className="edit-field">
            <span className="field-label">Địa chỉ</span>
            <Input.TextArea
              value={form.address}
              onChange={set("address")}
              placeholder="Số nhà, đường…"
              autoSize={{ minRows: 2, maxRows: 4 }}
              maxLength={200}
            />
          </label>
          <label className="edit-field">
            <span className="field-label">Link page Facebook</span>
            <Input
              value={form.pageUrl}
              onChange={set("pageUrl")}
              placeholder="https://facebook.com/…"
              prefix={<FacebookOutlined style={{ color: "var(--text-3)" }} />}
            />
          </label>

          {error && (
            <Alert type="error" showIcon message={error} style={{ marginTop: 4 }} />
          )}

          <div className="edit-actions">
            <Button onClick={() => setEditing(false)} disabled={saving}>
              Huỷ
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={saving}
              onClick={save}
              disabled={!form.shopName.trim() || !form.pageUrl.trim()}
            >
              Lưu thay đổi
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="field-grid" style={{ marginTop: 0, paddingTop: 0, border: 0 }}>
            <div>
              <span className="field-label">Khu vực</span>
              <span className={`field-value ${shop.district ? "" : "is-empty"}`}>
                {shop.district || "Chưa cập nhật"}
              </span>
            </div>
            <div>
              <span className="field-label">Địa chỉ</span>
              <span className={`field-value ${shop.address ? "" : "is-empty"}`}>
                {shop.address || "Chưa cập nhật"}
              </span>
            </div>
          </div>
          {shop.pageUrl && (
            <a
              className="page-link"
              href={shop.pageUrl}
              target="_blank"
              rel="noreferrer noopener"
              style={{ marginTop: 14 }}
            >
              {shop.pageUrl} <ExportOutlined />
            </a>
          )}
        </>
      )}
    </section>
  );
}
