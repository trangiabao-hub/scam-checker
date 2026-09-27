import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, Modal, Popconfirm, Spin, message } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  ExportOutlined,
  InboxOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { adminListActiveShops, adminRemoveMember, adminReviewShop } from "../api";
import { useAuth } from "../auth-context";
import UserAvatar from "./UserAvatar";

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const matchesShop = (shop, query) => {
  if (!query) return true;
  const fields = [
    shop.shopName,
    shop.district,
    shop.pageUrl,
    ...(shop.members ?? []).flatMap((m) => [m.fullName, m.email, m.phone]),
  ];
  return fields.some((f) => normalize(f).includes(query));
};

/* Admin xem các shop đã xác thực và nhân viên của từng shop. */
export default function ActiveShops() {
  const { token } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const [shops, setShops] = useState([]);
  const [totals, setTotals] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [busyMemberId, setBusyMemberId] = useState(null);
  const [revokeShop, setRevokeShop] = useState(null);
  const [revokeNote, setRevokeNote] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminListActiveShops(token);
      setShops(data?.shops ?? []);
      setTotals(data?.totals ?? null);
      setError("");
    } catch (e) {
      setError(e.message || "Không tải được danh sách shop.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const normalizedQuery = normalize(query);
  const visibleShops = useMemo(
    () => shops.filter((shop) => matchesShop(shop, normalizedQuery)),
    [shops, normalizedQuery],
  );

  const handleRemoveMember = async (member) => {
    setBusyMemberId(member.id);
    try {
      await adminRemoveMember(token, member.id);
      messageApi.success(`Đã thu hồi ${member.email}.`);
      await load();
    } catch (e) {
      messageApi.error(e.message || "Thu hồi nhân viên thất bại.");
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRevokeShop = async () => {
    if (!revokeShop) return;
    setIsRevoking(true);
    try {
      await adminReviewShop(token, revokeShop.id, { approve: false, note: revokeNote.trim() });
      messageApi.success(`Đã thu hồi xác thực ${revokeShop.shopName}.`);
      setRevokeShop(null);
      setRevokeNote("");
      await load();
    } catch (e) {
      messageApi.error(e.message || "Thu hồi xác thực thất bại.");
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div>
      {contextHolder}
      <div className="admin-head">
        <div className="admin-head-row" style={{ marginTop: 0 }}>
          {totals && (
            <div className="page-head-meta">
              <strong>{totals.shops}</strong>
              <span>
                shop đang hoạt động, {totals.accounts} tài khoản, {totals.activated} đã đăng nhập
              </span>
            </div>
          )}
          <Button icon={<ReloadOutlined />} onClick={load} loading={isLoading}>
            Tải lại
          </Button>
        </div>
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: "var(--text-3)" }} />}
          placeholder="Tìm shop, khu vực, tên hoặc email nhân viên"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginTop: 14 }}
        />
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

      {isLoading && shops.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center" }}>
          <Spin />
        </div>
      ) : visibleShops.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <InboxOutlined />
          </div>
          <h2>{shops.length === 0 ? "Chưa có shop nào hoạt động" : "Không có shop khớp"}</h2>
          <p>
            {shops.length === 0
              ? "Shop sẽ xuất hiện ở đây sau khi hồ sơ được duyệt."
              : "Thử từ khoá khác."}
          </p>
        </div>
      ) : (
        <div className="card-grid">
          {visibleShops.map((shop) => {
            const members = shop.members ?? [];
            const staffCount = members.filter((m) => m.role !== "OWNER").length;
            return (
              <article className="report-card" key={shop.id}>
                <div className="report-card-top">
                  <div style={{ minWidth: 0 }}>
                    <h3 className="report-card-name">{shop.shopName}</h3>
                    <div className="report-card-date">
                      {shop.district || "Chưa có khu vực"}
                      {shop.reviewedAt ? ` · duyệt ${formatDate(shop.reviewedAt)}` : ""}
                    </div>
                  </div>
                  <span className="shop-badge shop-badge-verified">
                    {staffCount} nhân viên
                  </span>
                </div>

                {shop.pageUrl && (
                  <a
                    className="page-link"
                    href={shop.pageUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Mở page <ExportOutlined />
                  </a>
                )}

                <div className="member-list" style={{ marginTop: 12 }}>
                  <p className="member-list-title">
                    Tài khoản ({shop.activatedCount}/{shop.memberCount} đã đăng nhập)
                  </p>
                  {members.map((m) => {
                    const isOwnerRow = m.role === "OWNER";
                    return (
                      <div className="member-row" key={m.id}>
                        <div className="member-identity">
                          <UserAvatar account={m} className="member-avatar" />
                          <div style={{ minWidth: 0 }}>
                            <div className="member-name">
                              {m.fullName || (isOwnerRow ? "Chủ shop" : "Chưa đặt tên")}
                              {isOwnerRow && <span className="member-tag">Chủ shop</span>}
                              {m.activated ? (
                                <span className="member-tag member-tag-ok">
                                  <CheckCircleOutlined /> Đã đăng nhập
                                </span>
                              ) : (
                                <span className="member-tag member-tag-wait">
                                  <ClockCircleOutlined /> Chờ đăng nhập
                                </span>
                              )}
                            </div>
                            <div className="member-email">
                              {m.email}
                              {m.phone ? ` · ${m.phone}` : ""}
                            </div>
                            {m.lastLoginAt && (
                              <div className="member-hint">
                                Đăng nhập gần nhất {formatDate(m.lastLoginAt)}
                              </div>
                            )}
                          </div>
                        </div>
                        {!isOwnerRow && (
                          <Popconfirm
                            title="Thu hồi quyền truy cập?"
                            description={`${m.email} sẽ không vào được ${shop.shopName} nữa.`}
                            okText="Thu hồi"
                            cancelText="Huỷ"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => handleRemoveMember(m)}
                          >
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              loading={busyMemberId === m.id}
                              aria-label={`Thu hồi ${m.email}`}
                            >
                              Thu hồi
                            </Button>
                          </Popconfirm>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="report-card-foot">
                  <Button
                    danger
                    block
                    icon={<StopOutlined />}
                    onClick={() => {
                      setRevokeShop(shop);
                      setRevokeNote("");
                    }}
                  >
                    Thu hồi xác thực shop
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(revokeShop)}
        title={revokeShop ? `Thu hồi xác thực ${revokeShop.shopName}?` : ""}
        okText="Thu hồi"
        cancelText="Huỷ"
        okButtonProps={{ danger: true, disabled: !revokeNote.trim() }}
        confirmLoading={isRevoking}
        onOk={handleRevokeShop}
        onCancel={() => setRevokeShop(null)}
        destroyOnHidden
      >
        <p className="hint" style={{ marginTop: 0 }}>
          Shop chuyển về trạng thái từ chối: cả shop bị coi là chưa xác thực và chủ shop
          không quản lý được nhân viên nữa. Chủ shop nhận email kèm lý do và có thể nộp lại hồ sơ.
        </p>
        <Input.TextArea
          value={revokeNote}
          onChange={(e) => setRevokeNote(e.target.value)}
          placeholder="Lý do thu hồi, bắt buộc"
          autoSize={{ minRows: 3, maxRows: 6 }}
          maxLength={500}
        />
      </Modal>
    </div>
  );
}
