import { useEffect, useState } from "react";
import { Alert, Button, Input, message } from "antd";
import {
  CheckOutlined,
  EditOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { updateProfile } from "../api";
import { useAuth } from "../auth-context";
import UserAvatar from "./UserAvatar";

/*
  Thẻ hồ sơ cá nhân: xem / sửa họ tên + SĐT. Email lấy từ Google nên khoá.
*/
export default function ProfileCard({ editable = true }) {
  const { token, account, email, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(account?.fullName ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) {
      setFullName(account?.fullName ?? "");
      setPhone(account?.phone ?? "");
    }
  }, [account, editing]);

  const startEdit = () => {
    setError("");
    setFullName(account?.fullName ?? "");
    setPhone(account?.phone ?? "");
    setEditing(true);
  };

  const cancelEdit = () => {
    setError("");
    setEditing(false);
  };

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      await updateProfile(token, { fullName, phone });
      await refresh();
      setEditing(false);
      message.success("Đã cập nhật thông tin cá nhân.");
    } catch (e) {
      setError(e.message || "Không lưu được thông tin.");
    } finally {
      setSaving(false);
    }
  };

  const roleLabel =
    account?.role === "OWNER"
      ? "Chủ shop"
      : account?.role === "MEMBER"
        ? "Nhân viên"
        : account?.role === "ADMIN"
          ? "Quản trị"
          : null;

  return (
    <section className="surface profile-card">
      <div className="surface-head">
        <h2 className="surface-title">
          <UserOutlined />
          Thông tin cá nhân
        </h2>
        {editable && !editing && (
          <Button size="small" icon={<EditOutlined />} onClick={startEdit}>
            Sửa
          </Button>
        )}
      </div>

      {editing ? (
        <div className="profile-edit">
          <label className="edit-field">
            <span className="field-label">Họ và tên</span>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              maxLength={80}
            />
          </label>
          <label className="edit-field">
            <span className="field-label">Số điện thoại</span>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              prefix={<PhoneOutlined style={{ color: "var(--text-3)" }} />}
              inputMode="tel"
              maxLength={11}
            />
          </label>
          <label className="edit-field">
            <span className="field-label">Email Google</span>
            <Input value={email} disabled prefix={<MailOutlined />} />
            <span className="hint">Email gắn với Google nên không đổi được.</span>
          </label>

          {error && (
            <Alert type="error" showIcon message={error} style={{ marginTop: 4 }} />
          )}

          <div className="edit-actions">
            <Button onClick={cancelEdit} disabled={saving}>
              Huỷ
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={saving}
              onClick={save}
              disabled={!fullName.trim()}
            >
              Lưu thay đổi
            </Button>
          </div>
        </div>
      ) : (
        <div className="profile-view">
          <div className="profile-identity">
            <UserAvatar account={account} className="profile-avatar" />
            <div style={{ minWidth: 0 }}>
              <div className="profile-name">
                {account?.fullName || "Chưa đặt tên"}
                {roleLabel && <span className="member-tag">{roleLabel}</span>}
              </div>
              <div className="member-email">{email}</div>
            </div>
          </div>
          <div className="field-grid" style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <div>
              <span className="field-label">Số điện thoại</span>
              <span className={`field-value num ${account?.phone ? "" : "is-empty"}`}>
                {account?.phone || "Chưa cập nhật"}
              </span>
            </div>
            <div>
              <span className="field-label">Vai trò</span>
              <span className="field-value">{roleLabel || "—"}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
