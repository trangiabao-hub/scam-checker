import { useState } from "react";
import { Alert, Button, Form, Image, Input, Select, Upload } from "antd";
import {
  DeleteOutlined,
  FacebookOutlined,
  InboxOutlined,
  PhoneOutlined,
  SendOutlined,
  ShopOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { registerShop, uploadShopProof } from "../api";
import { useAuth } from "../auth-context";

const HCM_DISTRICTS = [
  "Quận 1", "Quận 3", "Quận 4", "Quận 5", "Quận 6", "Quận 7", "Quận 8",
  "Quận 10", "Quận 11", "Quận 12", "Bình Thạnh", "Phú Nhuận", "Tân Bình",
  "Tân Phú", "Gò Vấp", "Bình Tân", "Thủ Đức", "Bình Chánh", "Hóc Môn",
  "Nhà Bè", "Củ Chi", "Cần Giờ",
].map((d) => ({ value: d, label: d }));

/*
  Hồ sơ xác thực shop. Email lấy từ Google nên không cho sửa, đó chính là thứ
  chứng minh danh tính. Ảnh được upload trước để lúc bấm gửi chỉ còn một request.
*/
export default function ShopRegisterForm({ initialShop, onDone }) {
  const { token, email, refresh } = useAuth();
  const isResubmit = initialShop?.status === "REJECTED";

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    shopName: initialShop?.shopName ?? "",
    district: initialShop?.district ?? undefined,
    address: initialShop?.address ?? "",
    pageUrl: initialShop?.pageUrl ?? "",
  });
  const [proofUrl, setProofUrl] = useState(initialShop?.proofImageUrl ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleUpload = async (file) => {
    setError("");
    if (!file.type?.startsWith("image/")) {
      setError("Vui lòng chọn file ảnh.");
      return Upload.LIST_IGNORE;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Ảnh quá lớn, giới hạn 10MB.");
      return Upload.LIST_IGNORE;
    }
    setIsUploading(true);
    try {
      setProofUrl(await uploadShopProof(token, file));
    } catch (e) {
      setError(e.message || "Tải ảnh thất bại.");
    } finally {
      setIsUploading(false);
    }
    return Upload.LIST_IGNORE;
  };

  const handleSubmit = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      await registerShop(token, { ...form, proofImageUrl: proofUrl });
      await refresh();
      onDone?.();
    } catch (e) {
      setError(e.message || "Gửi hồ sơ thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form layout="vertical" onFinish={handleSubmit}>
      <div className="form-stack">
        {isResubmit && initialShop?.reviewNote && (
          <Alert
            type="warning"
            showIcon
            message="Hồ sơ trước bị từ chối"
            description={initialShop.reviewNote}
          />
        )}

        <section className="surface" style={{ padding: 18 }}>
          <div className="surface-head">
            <h2 className="surface-title">
              <UserOutlined />
              Thông tin cá nhân
            </h2>
          </div>

          <Form.Item label="Email đăng nhập" style={{ marginBottom: 16 }}>
            <Input value={email} disabled />
          </Form.Item>

          <div className="form-row">
            <Form.Item label="Họ tên" required style={{ marginBottom: 0 }}>
              <Input
                prefix={<UserOutlined style={{ color: "var(--text-3)" }} />}
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="Tên của bạn"
              />
            </Form.Item>
            <Form.Item label="Số điện thoại" required style={{ marginBottom: 0 }}>
              <Input
                prefix={<PhoneOutlined style={{ color: "var(--text-3)" }} />}
                value={form.phone}
                onChange={(e) => update("phone", e.target.value.replace(/\D/g, ""))}
                placeholder="Số bạn dùng để liên hệ"
                className="num"
                maxLength={11}
              />
            </Form.Item>
          </div>
        </section>

        <section className="surface" style={{ padding: 18 }}>
          <div className="surface-head">
            <h2 className="surface-title">
              <ShopOutlined />
              Thông tin shop
            </h2>
          </div>

          <div className="form-row" style={{ marginBottom: 16 }}>
            <Form.Item label="Tên shop" required style={{ marginBottom: 0 }}>
              <Input
                value={form.shopName}
                onChange={(e) => update("shopName", e.target.value)}
                placeholder="Tên shop cho thuê máy ảnh"
              />
            </Form.Item>
            <Form.Item label="Quận" style={{ marginBottom: 0 }}>
              <Select
                value={form.district}
                onChange={(v) => update("district", v)}
                options={HCM_DISTRICTS}
                placeholder="Chọn quận tại TP HCM"
                showSearch
                allowClear
              />
            </Form.Item>
          </div>

          <Form.Item label="Địa chỉ" style={{ marginBottom: 0 }}>
            <Input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Số nhà, đường, phường"
            />
          </Form.Item>
        </section>

        <section className="surface" style={{ padding: 18 }}>
          <div className="surface-head">
            <h2 className="surface-title">
              <FacebookOutlined />
              Chứng minh bạn quản lý page
            </h2>
          </div>

          <Form.Item label="Link page Facebook của shop" required>
            <Input
              prefix={<FacebookOutlined style={{ color: "var(--text-3)" }} />}
              value={form.pageUrl}
              onChange={(e) => update("pageUrl", e.target.value)}
              placeholder="https://facebook.com/tenpagecuaban"
            />
          </Form.Item>

          <Form.Item
            label="Ảnh chụp màn hình trang quản lý page"
            required
            style={{ marginBottom: 0 }}
          >
            <p className="hint" style={{ margin: "0 0 12px" }}>
              Vào page của bạn khi đang đăng nhập tài khoản quản trị, chụp màn
              hình thấy rõ menu Quản lý trang bên trái và tên page. Ảnh mẫu bên
              dưới.
            </p>

            <div className="proof-example">
              <Image
                src="/vi-du-quan-ly-page.png"
                alt="Ảnh mẫu màn hình quản lý page Facebook, thấy rõ menu Quản lý trang bên trái"
                width={200}
              />
              <span className="hint">Bấm vào ảnh để xem lớn</span>
            </div>

            {proofUrl ? (
              <div className="proof-uploaded">
                <Image
                  src={proofUrl}
                  alt="Ảnh chứng minh bạn vừa tải lên"
                  width={160}
                />
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => setProofUrl("")}
                >
                  Chọn ảnh khác
                </Button>
              </div>
            ) : (
              <Upload.Dragger
                accept="image/*"
                multiple={false}
                showUploadList={false}
                beforeUpload={handleUpload}
                disabled={isUploading}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">
                  {isUploading ? "Đang tải ảnh" : "Kéo ảnh vào đây hoặc bấm để chọn"}
                </p>
                <p className="ant-upload-hint">Tối đa 10MB</p>
              </Upload.Dragger>
            )}
          </Form.Item>
        </section>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          closable
          onClose={() => setError("")}
          style={{ marginTop: 18 }}
        />
      )}

      <Button
        type="primary"
        htmlType="submit"
        size="large"
        block
        icon={<SendOutlined />}
        loading={isSubmitting}
        disabled={isUploading}
        style={{ marginTop: 18 }}
      >
        {isResubmit ? "Gửi lại hồ sơ" : "Gửi hồ sơ xác thực"}
      </Button>
    </Form>
  );
}
