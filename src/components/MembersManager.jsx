import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Input, Popconfirm, Spin } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  MailOutlined,
  TeamOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { addMember, listMembers, removeMember } from "../api";
import { useAuth } from "../auth-context";
import UserAvatar from "./UserAvatar";

/*
  Chủ shop mời nhân viên bằng email Google.
  Không tạo mật khẩu: nhân viên đăng nhập đúng email đó là vào được.
*/
export default function MembersManager() {
  const { token, account } = useAuth();
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setMembers(await listMembers(token));
      setError("");
    } catch (e) {
      setError(e.message || "Không tải được danh sách nhân viên.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const staff = members.filter((m) => m.role !== "OWNER");
  const pendingCount = staff.filter((m) => !m.activated).length;

  const handleAdd = async () => {
    setError("");
    setSuccess("");
    setIsAdding(true);
    try {
      const added = await addMember(token, { email: newEmail, fullName: newName });
      setNewEmail("");
      setNewName("");
      setSuccess(
        `Đã thêm ${added.email}. Nhờ họ đăng nhập Google bằng đúng email này để kích hoạt.`
      );
      await load();
    } catch (e) {
      setError(e.message || "Thêm nhân viên thất bại.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id) => {
    setError("");
    setSuccess("");
    try {
      await removeMember(token, id);
      await load();
    } catch (e) {
      setError(e.message || "Xoá nhân viên thất bại.");
    }
  };

  return (
    <section className="surface profile-card">
      <div className="surface-head">
        <h2 className="surface-title">
          <TeamOutlined />
          Nhân viên của shop
        </h2>
        <span className="hint">
          {staff.length} nhân viên
          {pendingCount > 0 ? ` · ${pendingCount} chưa đăng nhập` : ""}
        </span>
      </div>

      <div className="invite-guide">
        <p className="invite-guide-title">Cách thêm nhân viên</p>
        <ol className="invite-steps">
          <li>
            Nhập <strong>email Google</strong> nhân viên đang dùng (Gmail hoặc
            Workspace).
          </li>
          <li>Bấm <strong>Mời vào shop</strong> — không cần tạo mật khẩu.</li>
          <li>
            Nhờ họ mở ScamChecker và <strong>đăng nhập Google bằng đúng email đó</strong>.
          </li>
        </ol>
        <p className="hint" style={{ margin: "10px 0 0" }}>
          Nhân viên không tự đăng ký shop được. Chỉ vào được sau khi bạn mời.
        </p>
      </div>

      <div className="invite-form">
        <p className="invite-form-title">
          <UserAddOutlined /> Mời nhân viên mới
        </p>
        <label className="edit-field">
          <span className="field-label">
            Email Google <span className="req">*</span>
          </span>
          <Input
            prefix={<MailOutlined style={{ color: "var(--text-3)" }} />}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="nhanvien@gmail.com"
            type="email"
            autoComplete="off"
          />
        </label>
        <label className="edit-field">
          <span className="field-label">Tên hiển thị (tuỳ chọn)</span>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ví dụ: Minh — thu ngân"
            maxLength={80}
          />
        </label>
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          onClick={handleAdd}
          loading={isAdding}
          disabled={!newEmail.trim()}
          block
          size="large"
        >
          Mời vào shop
        </Button>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          closable
          onClose={() => setError("")}
          style={{ marginTop: 14 }}
        />
      )}
      {success && (
        <Alert
          type="success"
          showIcon
          message={success}
          closable
          onClose={() => setSuccess("")}
          style={{ marginTop: 14 }}
        />
      )}

      <div className="member-list">
        <p className="member-list-title">Danh sách tài khoản</p>
        {isLoading ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <Spin size="small" />
          </div>
        ) : members.length === 0 ? (
          <p className="hint" style={{ margin: "8px 0 0" }}>
            Chưa có tài khoản nào.
          </p>
        ) : (
          members.map((m) => {
            const isSelf = m.id === account?.id;
            const isOwnerRow = m.role === "OWNER";
            return (
              <div className="member-row" key={m.id}>
                <div className="member-identity">
                  <UserAvatar account={m} className="member-avatar" />
                  <div style={{ minWidth: 0 }}>
                    <div className="member-name">
                      {m.fullName || (isOwnerRow ? "Chủ shop" : "Chưa đặt tên")}
                      {isOwnerRow && <span className="member-tag">Chủ shop</span>}
                      {isSelf && !isOwnerRow && (
                        <span className="member-tag">Bạn</span>
                      )}
                      {!isOwnerRow &&
                        (m.activated ? (
                          <span className="member-tag member-tag-ok">
                            <CheckCircleOutlined /> Đã đăng nhập
                          </span>
                        ) : (
                          <span className="member-tag member-tag-wait">
                            <ClockCircleOutlined /> Chờ đăng nhập
                          </span>
                        ))}
                    </div>
                    <div className="member-email">{m.email}</div>
                    {!isOwnerRow && !m.activated && (
                      <div className="member-hint">
                        Gửi email này cho họ và nhờ đăng nhập Google trên ScamChecker.
                      </div>
                    )}
                  </div>
                </div>
                {!isSelf && !isOwnerRow && (
                  <Popconfirm
                    title="Thu hồi quyền truy cập?"
                    description={`${m.email} sẽ không vào được shop nữa.`}
                    okText="Thu hồi"
                    cancelText="Huỷ"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleRemove(m.id)}
                  >
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={`Thu hồi ${m.email}`}
                    >
                      Thu hồi
                    </Button>
                  </Popconfirm>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
