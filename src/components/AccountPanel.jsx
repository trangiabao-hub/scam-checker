import { Alert, Button, Spin } from "antd";
import {
  ClockCircleOutlined,
  CloseCircleOutlined,
  GoogleOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth-context";
import ShopRegisterForm from "./ShopRegisterForm";
import MembersManager from "./MembersManager";
import AdminReview from "./AdminReview";
import ProfileCard from "./ProfileCard";
import ShopCard from "./ShopCard";

/* Nội dung tab Tài khoản đổi theo trạng thái xác thực của người đang đăng nhập. */
export default function AccountPanel() {
  const {
    isRestoring,
    isSignedIn,
    isRegistered,
    isAdmin,
    isOwner,
    account,
    shop,
    email,
    authError,
    clearAuthError,
    isSigningIn,
    signIn,
    signOut,
  } = useAuth();

  if (isRestoring) {
    return (
      <div style={{ padding: "64px 0", textAlign: "center" }}>
        <Spin />
      </div>
    );
  }

  /* Chưa đăng nhập */
  if (!isSignedIn) {
    return (
      <div className="tab-panel">
        <header className="page-head">
          <h1>Xác thực chủ shop</h1>
          <p>
            Dữ liệu tố cáo do cộng đồng đóng góp nên chỉ mở cho chủ shop cho thuê
            máy ảnh tại TP HCM. Đăng nhập bằng Google để bắt đầu.
          </p>
        </header>

        {authError && (
          <Alert
            type="error"
            showIcon
            message={authError}
            closable
            onClose={clearAuthError}
            style={{ marginBottom: 16 }}
          />
        )}

        <section className="surface" style={{ padding: 22 }}>
          <h2 className="surface-title" style={{ marginBottom: 12 }}>
            <SafetyCertificateOutlined />
            Cách xác thực
          </h2>
          <ol className="steps">
            <li>Đăng nhập bằng tài khoản Google của bạn.</li>
            <li>Điền thông tin cá nhân và thông tin shop.</li>
            <li>
              Dán link page Facebook và tải ảnh chụp màn hình cho thấy bạn đang
              quản lý page đó.
            </li>
            <li>
              Chúng tôi đối chiếu rồi duyệt. Sau khi duyệt, bạn thêm được tài
              khoản cho nhân viên của mình.
            </li>
          </ol>

          <Button
            type="primary"
            size="large"
            block
            icon={<GoogleOutlined />}
            loading={isSigningIn}
            onClick={signIn}
            style={{ marginTop: 20 }}
          >
            Đăng nhập bằng Google
          </Button>
        </section>
      </div>
    );
  }

  const header = (
    <header className="page-head">
      <div className="account-head">
        <div style={{ minWidth: 0 }}>
          <h1>{isAdmin ? "Duyệt hồ sơ shop" : "Tài khoản"}</h1>
          <p style={{ marginTop: 6 }}>
            {account?.fullName ? `${account.fullName} · ${email}` : email}
          </p>
        </div>
        <Button icon={<LogoutOutlined />} onClick={signOut}>
          Đăng xuất
        </Button>
      </div>
    </header>
  );

  /* Người của FAO duyệt hồ sơ */
  if (isAdmin) {
    return (
      <div className="tab-panel">
        {header}
        <AdminReview />
      </div>
    );
  }

  /* Đã đăng nhập Google nhưng chưa có hồ sơ */
  if (!isRegistered) {
    return (
      <div className="tab-panel">
        {header}
        <Alert
          type="info"
          showIcon
          message="Chưa có hồ sơ shop"
          description="Điền biểu mẫu bên dưới để gửi hồ sơ xác thực. Nếu bạn là nhân viên, hãy nhờ chủ shop thêm email này vào shop thay vì tự đăng ký."
          style={{ marginBottom: 18 }}
        />
        <ShopRegisterForm />
      </div>
    );
  }

  /* Nhân viên do chủ shop thêm vào */
  if (!isOwner) {
    return (
      <div className="tab-panel">
        {header}
        <div className="form-stack">
          <ProfileCard editable />
          {shop ? (
            <ShopCard shop={shop} editable={false} />
          ) : (
            <Alert
              type="warning"
              showIcon
              message="Tài khoản chưa gắn với shop nào"
              description="Hãy liên hệ chủ shop để được thêm lại."
            />
          )}
        </div>
      </div>
    );
  }

  /* Chủ shop, chia theo trạng thái hồ sơ */
  if (shop?.status === "PENDING") {
    return (
      <div className="tab-panel">
        {header}
        <div className="form-stack">
          <div className="status-card">
            <div className="status-card-icon">
              <ClockCircleOutlined />
            </div>
            <h2>Hồ sơ đang chờ duyệt</h2>
            <p>
              Chúng tôi đang đối chiếu page <strong>{shop.shopName}</strong> với
              ảnh bạn gửi. Bạn sẽ thêm được nhân viên ngay sau khi hồ sơ được
              duyệt.
            </p>
          </div>
          <ProfileCard editable />
          <ShopCard shop={shop} editable={false} />
        </div>
      </div>
    );
  }

  if (shop?.status === "REJECTED") {
    return (
      <div className="tab-panel">
        {header}
        <div className="status-card status-card-rejected">
          <div className="status-card-icon">
            <CloseCircleOutlined />
          </div>
          <h2>Hồ sơ chưa được duyệt</h2>
          <p>{shop.reviewNote || "Thông tin chưa đủ để đối chiếu."}</p>
        </div>
        <div style={{ marginTop: 18 }}>
          <ShopRegisterForm initialShop={shop} />
        </div>
      </div>
    );
  }

  return (
    <div className="tab-panel">
      {header}
      <div className="form-stack">
        <ProfileCard editable />
        {shop && <ShopCard shop={shop} editable />}
        <MembersManager />
      </div>
    </div>
  );
}
