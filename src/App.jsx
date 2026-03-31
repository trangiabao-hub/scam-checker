import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Layout,
  Card,
  Tabs,
  Input,
  Button,
  Form,
  Upload,
  Modal,
  Image,
  Tag,
  Pagination,
  Alert,
  Descriptions,
  List,
  Statistic,
  Empty,
  Spin,
  Typography,
  Space,
  Row,
  Col,
  Divider,
  Flex,
  Grid,
  Tooltip,
  theme,
  message,
} from "antd";
import {
  SearchOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  IdcardOutlined,
  PhoneOutlined,
  UserOutlined,
  CalendarOutlined,
  CameraOutlined,
  WarningOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  PictureOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  ToolOutlined,
  InboxOutlined,
  FileSearchOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
  NumberOutlined,
  FireOutlined,
  TeamOutlined,
  DatabaseOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import "./App.css";
import {
  createReport,
  fetchReports,
  hasApiConfig,
  uploadEvidenceFile,
} from "./api";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

const MAX_IMAGES = 6;
const MAX_IMAGE_MB = 5;
const MAX_EQUIPMENT_ITEMS = 10;
const HOME_REPORTS_PER_PAGE = 6;
const createEmptyEquipmentItem = () => ({ deviceName: "", serialNumber: "" });

const isValidCccd = (value) => /^\d{12}$/.test(value);
const normalizeSearchText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const formatDate = (value) => new Date(value).toLocaleString("vi-VN");
const hasSubmitterInfo = (report) =>
  Boolean(report.submitterName?.trim() || report.submitterPhone?.trim());

const getRiskLevel = (count) => {
  if (count >= 3)
    return {
      label: "Rủi ro cao",
      badgeClass: "risk-badge risk-badge-high",
      icon: <FireOutlined />,
    };
  if (count >= 1)
    return {
      label: "Có cảnh báo",
      badgeClass: "risk-badge risk-badge-medium",
      icon: <WarningOutlined />,
    };
  return {
    label: "An toàn tạm thời",
    badgeClass: "risk-badge risk-badge-low",
    icon: <CheckCircleOutlined />,
  };
};

const normalizeReport = (row) => ({
  id: row.id ?? row._id ?? row.reportId ?? crypto.randomUUID(),
  cccd: row.cccd ?? "",
  scammerName: row.reporter_name ?? row.scammerName ?? row.reporterName ?? "",
  scammerPhone: row.phone ?? row.scammerPhone ?? "",
  submitterName: row.submitter_name ?? row.submitterName ?? "",
  submitterPhone: row.submitter_phone ?? row.submitterPhone ?? "",
  description: row.description ?? "",
  imageUrls: row.image_urls ?? row.imageUrls ?? [],
  equipmentItems: Array.isArray(row.equipment_items ?? row.equipmentItems)
    ? (row.equipment_items ?? row.equipmentItems)
        .map((item) => ({
          deviceName: String(item?.deviceName ?? "").trim(),
          serialNumber: String(item?.serialNumber ?? "").trim(),
        }))
        .filter((item) => item.deviceName && item.serialNumber)
    : [],
  createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  createdAtMs:
    row.created_at_ms ??
    row.createdAtMs ??
    new Date(row.created_at ?? row.createdAt ?? Date.now()).getTime(),
});

/* ══════════════════════════════════════════════
   REPORT DETAIL MODAL
   ══════════════════════════════════════════════ */

function ReportDetailModal({ report, open, onClose }) {
  if (!report) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      className="premium-modal"
      title={
        <div>
          <span className="kicker">Chi tiết tố cáo</span>
          <Title level={4} style={{ margin: 0 }}>
            {report.scammerName || "Không rõ đối tượng"}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {formatDate(report.createdAt)}
          </Text>
        </div>
      }
    >
      <Descriptions
        bordered
        size="small"
        column={{ xs: 1, sm: 2 }}
        className="premium-descriptions"
        style={{ marginBottom: 18 }}
      >
        <Descriptions.Item label={<><IdcardOutlined /> CCCD</>}>
          <Text strong copyable={{ text: report.cccd }}>
            {report.cccd || "Không cung cấp"}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label={<><PhoneOutlined /> SĐT đối tượng</>}>
          <Text strong>
            {report.scammerPhone?.trim() || "Không cung cấp"}
          </Text>
        </Descriptions.Item>
        {hasSubmitterInfo(report) && (
          <>
            <Descriptions.Item label={<><UserOutlined /> Người đăng</>}>
              <Text strong>
                {report.submitterName?.trim() || "Không cung cấp"}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label={<><PhoneOutlined /> SĐT người đăng</>}>
              <Text strong>
                {report.submitterPhone?.trim() || "Không cung cấp"}
              </Text>
            </Descriptions.Item>
          </>
        )}
      </Descriptions>

      <div className="modal-section">
        <Text className="modal-section-title">
          <ExclamationCircleOutlined /> Nội dung tố cáo
        </Text>
        <Paragraph style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.8 }}>
          {report.description || "Không có nội dung"}
        </Paragraph>
      </div>

      {report.equipmentItems?.length > 0 && (
        <div className="modal-section">
          <Text className="modal-section-title">
            <CameraOutlined /> Thiết bị liên quan
          </Text>
          <Flex wrap gap={8}>
            {report.equipmentItems.map((eq, idx) => (
              <Tag key={idx} className="equip-tag" icon={<CameraOutlined />}>
                {eq.deviceName} — S/N: {eq.serialNumber}
              </Tag>
            ))}
          </Flex>
        </div>
      )}

      <div className="modal-section" style={{ marginBottom: 0 }}>
        <Text className="modal-section-title">
          <PictureOutlined /> Ảnh bằng chứng
        </Text>
        {report.imageUrls?.length > 0 ? (
          <Image.PreviewGroup>
            <Flex wrap gap={10}>
              {report.imageUrls.map((url, idx) => (
                <Image
                  key={url}
                  src={url}
                  alt={`Bằng chứng ${idx + 1}`}
                  width={130}
                  height={100}
                  style={{ objectFit: "cover", borderRadius: 10 }}
                  placeholder
                />
              ))}
            </Flex>
          </Image.PreviewGroup>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa có ảnh bằng chứng"
          />
        )}
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════
   REPORT CARD (reusable)
   ══════════════════════════════════════════════ */

function ReportCard({ item, onViewDetail, compact }) {
  return (
    <Card
      size="small"
      hoverable
      className="report-card"
      style={{ borderRadius: 16 }}
    >
      <Flex justify="space-between" align="flex-start" gap={12}>
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: 15 }}>
            {item.scammerName || "Không rõ"}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <ClockCircleOutlined style={{ marginRight: 3 }} />
            {formatDate(item.createdAt)}
          </Text>
        </Space>
        {onViewDetail && (
          <Tooltip title="Xem chi tiết đầy đủ">
            <Button
              type="primary"
              ghost
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onViewDetail(item)}
              style={{ borderRadius: 8 }}
            >
              Chi tiết
            </Button>
          </Tooltip>
        )}
      </Flex>

      <Divider style={{ margin: "12px 0" }} />

      <Row gutter={[10, 8]}>
        <Col xs={24} sm={compact ? 24 : 8}>
          <div style={{
            padding: "8px 12px",
            borderRadius: 10,
            background: "#f8fafc",
            border: "1px solid #f1f5f9",
          }}>
            <Text style={{ fontSize: 11, color: "#94a3b8", display: "block", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              CCCD
            </Text>
            <Text strong style={{ fontSize: 13, fontFamily: "monospace" }}>
              {item.cccd}
            </Text>
          </div>
        </Col>
        <Col xs={24} sm={compact ? 24 : 8}>
          <div style={{
            padding: "8px 12px",
            borderRadius: 10,
            background: "#f8fafc",
            border: "1px solid #f1f5f9",
          }}>
            <Text style={{ fontSize: 11, color: "#94a3b8", display: "block", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              SĐT đối tượng
            </Text>
            <Text strong style={{ fontSize: 13 }}>
              {item.scammerPhone?.trim() || "—"}
            </Text>
          </div>
        </Col>
        {hasSubmitterInfo(item) && (
          <Col xs={24} sm={compact ? 24 : 8}>
            <div style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #f1f5f9",
            }}>
              <Text style={{ fontSize: 11, color: "#94a3b8", display: "block", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Người đăng
              </Text>
              <Text strong style={{ fontSize: 13 }}>
                {item.submitterName?.trim() || "—"}
              </Text>
            </div>
          </Col>
        )}
      </Row>

      <Paragraph
        type="secondary"
        ellipsis={{ rows: 2 }}
        style={{ marginTop: 10, marginBottom: 0, fontSize: 13, lineHeight: 1.7 }}
      >
        {item.description}
      </Paragraph>

      {item.equipmentItems?.length > 0 && (
        <Flex wrap gap={6} style={{ marginTop: 10 }}>
          {item.equipmentItems.map((eq, idx) => (
            <Tag key={idx} className="equip-tag" style={{ fontSize: 12 }}>
              <CameraOutlined /> {eq.deviceName} — {eq.serialNumber}
            </Tag>
          ))}
        </Flex>
      )}

      {item.imageUrls?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Image.PreviewGroup>
            <Flex wrap gap={6}>
              {item.imageUrls.map((url, idx) => (
                <Image
                  key={url}
                  src={url}
                  alt={`Bằng chứng ${idx + 1}`}
                  width={72}
                  height={54}
                  style={{ objectFit: "cover", borderRadius: 8 }}
                  placeholder
                />
              ))}
            </Flex>
          </Image.PreviewGroup>
        </div>
      )}
    </Card>
  );
}

/* ══════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════ */

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const screens = useBreakpoint();
  const { token } = theme.useToken();

  const [activeTab, setActiveTab] = useState("all");
  const [reports, setReports] = useState([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [dataError, setDataError] = useState("");

  const [queryKeyword, setQueryKeyword] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");

  const [reportForm, setReportForm] = useState({
    cccd: "",
    scammerName: "",
    scammerPhone: "",
    submitterName: "",
    submitterPhone: "",
    description: "",
  });
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState("");
  const [reportImages, setReportImages] = useState([]);
  const [equipmentItems, setEquipmentItems] = useState([
    createEmptyEquipmentItem(),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [homePage, setHomePage] = useState(1);

  /* ── data loading ────────────────────────── */

  const loadReports = useCallback(async () => {
    const data = await fetchReports();
    const normalizedReports = (data ?? [])
      .map(normalizeReport)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
    setReports(normalizedReports);
  }, []);

  useEffect(() => {
    if (!hasApiConfig) {
      setDataError(
        "Chưa cấu hình API. Hãy tạo file .env từ .env.example và khai báo VITE_API_BASE_URL.",
      );
      setIsLoadingReports(false);
      return;
    }
    const init = async () => {
      try {
        await loadReports();
        setDataError("");
      } catch {
        setDataError(
          "Không đọc được dữ liệu từ API. Kiểm tra lại endpoint và biến môi trường.",
        );
      } finally {
        setIsLoadingReports(false);
      }
    };
    init();
  }, [loadReports]);

  /* ── search logic ────────────────────────── */

  const findMatches = useCallback(
    (keyword) => {
      const norm = normalizeSearchText(keyword);
      const digits = String(keyword ?? "").replace(/\D/g, "");
      if (!norm) return [];
      return reports.filter((item) => {
        const fields = [item.cccd, item.scammerPhone, item.submitterPhone, item.scammerName, item.submitterName];
        const textMatch = fields.some((f) => normalizeSearchText(f).includes(norm));
        const digitMatch = digits
          ? [item.cccd, item.scammerPhone, item.submitterPhone].some((f) =>
              String(f ?? "").replace(/\D/g, "").includes(digits),
            )
          : false;
        return textMatch || digitMatch;
      });
    },
    [reports],
  );

  useEffect(() => {
    if (searchResult === null || !queryKeyword.trim()) return;
    setSearchResult(findMatches(queryKeyword));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findMatches]);

  const totalReports = reports.length;
  const totalHomePages = useMemo(
    () => Math.max(1, Math.ceil(reports.length / HOME_REPORTS_PER_PAGE)),
    [reports.length],
  );
  const paginatedReports = useMemo(() => {
    const s = (homePage - 1) * HOME_REPORTS_PER_PAGE;
    return reports.slice(s, s + HOME_REPORTS_PER_PAGE);
  }, [homePage, reports]);

  const totalEvidenceInSearch = useMemo(
    () =>
      Array.isArray(searchResult)
        ? searchResult.reduce(
            (sum, i) => sum + (i.imageUrls?.length ?? 0) + (i.equipmentItems?.length ?? 0),
            0,
          )
        : 0,
    [searchResult],
  );

  const latestFoundAt = useMemo(() => {
    if (!Array.isArray(searchResult) || searchResult.length === 0) return "";
    const newest = searchResult.reduce((cur, i) =>
      i.createdAtMs > cur.createdAtMs ? i : cur,
    );
    return formatDate(newest.createdAt);
  }, [searchResult]);

  /* ── handlers ────────────────────────────── */

  const handleCheck = () => {
    setSearchError("");
    if (!queryKeyword.trim()) {
      setSearchResult(null);
      setSelectedReport(null);
      setSearchError("Vui lòng nhập CCCD, số điện thoại hoặc tên để tra cứu.");
      return;
    }
    setSearchResult(findMatches(queryKeyword));
    setSelectedReport(null);
  };

  useEffect(() => {
    setHomePage((p) => Math.min(p, totalHomePages));
  }, [totalHomePages]);

  const updateReportField = (field, value) =>
    setReportForm((prev) => ({ ...prev, [field]: value }));

  const handleImageChange = (info) => {
    const fileList = info.fileList.slice(0, MAX_IMAGES);
    const bad = fileList.find(
      (f) =>
        f.originFileObj &&
        (!f.originFileObj.type.startsWith("image/") ||
          f.originFileObj.size > MAX_IMAGE_MB * 1024 * 1024),
    );
    if (bad) {
      setReportError(`File ${bad.name} không hợp lệ. Chỉ nhận ảnh ≤ ${MAX_IMAGE_MB}MB.`);
      return;
    }
    setReportError("");
    setReportImages(fileList);
  };

  const updateEquipmentItem = (idx, field, value) =>
    setEquipmentItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    );

  const addEquipmentItem = () => {
    setReportError("");
    setEquipmentItems((prev) => {
      if (prev.length >= MAX_EQUIPMENT_ITEMS) {
        setReportError(`Tối đa ${MAX_EQUIPMENT_ITEMS} thiết bị.`);
        return prev;
      }
      return [...prev, createEmptyEquipmentItem()];
    });
  };

  const removeEquipmentItem = (idx) => {
    setReportError("");
    setEquipmentItems((prev) =>
      prev.length === 1
        ? [createEmptyEquipmentItem()]
        : prev.filter((_, i) => i !== idx),
    );
  };

  const handleSubmitReport = async () => {
    setReportError("");
    setReportSuccess("");

    if (!hasApiConfig) { setReportError("API chưa cấu hình."); return; }
    if (!isValidCccd(reportForm.cccd)) { setReportError("CCCD phải đúng 12 chữ số."); return; }
    if (!reportForm.description.trim()) { setReportError("Vui lòng nhập nội dung tố cáo."); return; }

    const trimmed = equipmentItems
      .map((i) => ({ deviceName: i.deviceName.trim(), serialNumber: i.serialNumber.trim() }))
      .filter((i) => i.deviceName || i.serialNumber);
    if (trimmed.find((i) => !i.deviceName || !i.serialNumber)) {
      setReportError("Mỗi thiết bị cần đủ tên máy và số seri.");
      return;
    }

    try {
      setIsSubmitting(true);
      const files = reportImages.map((f) => f.originFileObj).filter(Boolean);
      const imageUrls = await Promise.all(
        files.map((file) => uploadEvidenceFile({ file, cccd: reportForm.cccd })),
      );
      await createReport({
        cccd: reportForm.cccd,
        reporter_name: reportForm.scammerName.trim() || "Không rõ",
        phone: reportForm.scammerPhone.trim(),
        submitter_name: reportForm.submitterName.trim(),
        submitter_phone: reportForm.submitterPhone.trim(),
        description: reportForm.description.trim(),
        image_urls: imageUrls,
        equipment_items: trimmed,
        created_at: new Date().toISOString(),
        created_at_ms: Date.now(),
      });
      await loadReports();
      setReportForm({ cccd: "", scammerName: "", scammerPhone: "", submitterName: "", submitterPhone: "", description: "" });
      setReportImages([]);
      setEquipmentItems([createEmptyEquipmentItem()]);
      setReportSuccess("Tố cáo đã được ghi nhận thành công.");
      messageApi.success("Tố cáo đã được ghi nhận!");
    } catch (error) {
      setReportError(`Gửi thất bại: ${error instanceof Error ? error.message : "Lỗi không xác định"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ══════════════════════════════════════════
     SEARCH PANEL
     ══════════════════════════════════════════ */

  const searchPanel = (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <span className="kicker">Kiểm tra trước khi giao máy</span>
        <Title level={4} style={{ margin: 0 }}>
          Tra cứu CCCD, SĐT hoặc tên
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Nhập thông tin để kiểm tra lịch sử tố cáo trong hệ thống
        </Text>
      </div>

      <div className="premium-search" style={{ marginBottom: 20 }}>
        <Input.Search
          size="large"
          value={queryKeyword}
          onChange={(e) => setQueryKeyword(e.target.value)}
          onSearch={handleCheck}
          placeholder="Nhập CCCD, số điện thoại hoặc tên..."
          enterButton="Kiểm tra"
        />
      </div>

      {searchError && (
        <Alert
          type="warning"
          message={searchError}
          showIcon
          closable
          onClose={() => setSearchError("")}
          style={{ marginBottom: 16 }}
        />
      )}

      {searchResult ? (
        <div className="fade-in">
          {/* Result header */}
          <Card
            style={{ marginBottom: 16, borderRadius: 16, border: "1px solid #e2e8f0" }}
            styles={{ body: { padding: "18px 22px" } }}
          >
            <Flex justify="space-between" align="center" wrap gap={12}>
              <Space direction="vertical" size={2}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Kết quả tra cứu cho
                </Text>
                <Title level={4} style={{ margin: 0, fontFamily: "monospace" }}>
                  {queryKeyword}
                </Title>
              </Space>
              <div className={getRiskLevel(searchResult.length).badgeClass}>
                {getRiskLevel(searchResult.length).icon}{" "}
                {getRiskLevel(searchResult.length).label}
              </div>
            </Flex>
          </Card>

          {/* Metrics */}
          <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
            <Col xs={24} sm={8}>
              <Card size="small" className="stat-card" style={{ borderRadius: 14 }}>
                <Statistic
                  title="Tổng tố cáo khớp"
                  value={searchResult.length}
                  prefix={<AlertOutlined style={{ color: "#4f46e5" }} />}
                  valueStyle={{ color: "#0f172a", fontWeight: 800 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" className="stat-card" style={{ borderRadius: 14 }}>
                <Statistic
                  title="Bằng chứng"
                  value={totalEvidenceInSearch}
                  prefix={<CameraOutlined style={{ color: "#4f46e5" }} />}
                  valueStyle={{ color: "#0f172a", fontWeight: 800 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" className="stat-card" style={{ borderRadius: 14 }}>
                <Statistic
                  title="Tố cáo gần nhất"
                  value={latestFoundAt || "—"}
                  valueStyle={{ fontSize: 14, color: "#0f172a", fontWeight: 700 }}
                  prefix={<CalendarOutlined style={{ color: "#4f46e5" }} />}
                />
              </Card>
            </Col>
          </Row>

          {/* Result list */}
          {searchResult.length > 0 ? (
            <List
              dataSource={searchResult}
              rowKey="id"
              split={false}
              renderItem={(item) => (
                <List.Item style={{ padding: "6px 0", border: "none" }}>
                  <div style={{ width: "100%" }}>
                    <ReportCard item={item} onViewDetail={setSelectedReport} />
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <Alert
              type="success"
              message="Không tìm thấy tố cáo nào cho thông tin này."
              description="Thông tin này chưa xuất hiện trong hệ thống cảnh báo."
              icon={<CheckCircleOutlined />}
              showIcon
              style={{ borderRadius: 14 }}
            />
          )}
        </div>
      ) : (
        <div className="empty-search-state">
          <div className="empty-search-icon">
            <FileSearchOutlined />
          </div>
          <Title level={5} style={{ margin: "0 0 6px", color: "#475569" }}>
            Chưa có tra cứu nào
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Nhập CCCD / SĐT / tên vào ô tìm kiếm để kiểm tra lịch sử tố cáo
          </Text>
        </div>
      )}
    </div>
  );

  /* ══════════════════════════════════════════
     REPORT PANEL
     ══════════════════════════════════════════ */

  const reportPanel = (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <span className="kicker">Báo cáo cộng đồng</span>
        <Title level={4} style={{ margin: 0 }}>
          Gửi tố cáo mới
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Thông tin sẽ giúp cộng đồng phòng tránh scam khi cho thuê máy ảnh
        </Text>
      </div>

      <Form layout="vertical" onFinish={handleSubmitReport} className="premium-form">
        {/* ── Thông tin đối tượng ── */}
        <Card
          size="small"
          style={{ marginBottom: 20, borderRadius: 14, background: "#fafafe", border: "1px solid #f1f5f9" }}
          styles={{ body: { padding: 18 } }}
        >
          <Text strong style={{ fontSize: 13, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 14 }}>
            <SafetyOutlined style={{ marginRight: 6 }} />
            Thông tin đối tượng bị tố cáo
          </Text>

          <Form.Item label="CCCD (12 chữ số)" required style={{ marginBottom: 14 }}>
            <Input
              prefix={<IdcardOutlined style={{ color: "#94a3b8" }} />}
              size="large"
              value={reportForm.cccd}
              onChange={(e) => updateReportField("cccd", e.target.value.replace(/\D/g, ""))}
              maxLength={12}
              placeholder="Nhập CCCD đối tượng"
              showCount
              style={{ fontFamily: "monospace" }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Họ tên đối tượng" style={{ marginBottom: 0 }}>
                <Input
                  prefix={<UserOutlined style={{ color: "#94a3b8" }} />}
                  value={reportForm.scammerName}
                  onChange={(e) => updateReportField("scammerName", e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="SĐT đối tượng" style={{ marginBottom: 0 }}>
                <Input
                  prefix={<PhoneOutlined style={{ color: "#94a3b8" }} />}
                  value={reportForm.scammerPhone}
                  onChange={(e) => updateReportField("scammerPhone", e.target.value)}
                  placeholder="Nếu có"
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Người đăng ── */}
        <Card
          size="small"
          style={{ marginBottom: 20, borderRadius: 14, background: "#fafafe", border: "1px solid #f1f5f9" }}
          styles={{ body: { padding: 18 } }}
        >
          <Text strong style={{ fontSize: 13, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 14 }}>
            <TeamOutlined style={{ marginRight: 6 }} />
            Thông tin người đăng (không bắt buộc)
          </Text>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Họ tên bạn" style={{ marginBottom: 0 }}>
                <Input
                  prefix={<UserOutlined style={{ color: "#94a3b8" }} />}
                  value={reportForm.submitterName}
                  onChange={(e) => updateReportField("submitterName", e.target.value)}
                  placeholder="Tên của bạn"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="SĐT liên hệ" style={{ marginBottom: 0 }}>
                <Input
                  prefix={<PhoneOutlined style={{ color: "#94a3b8" }} />}
                  value={reportForm.submitterPhone}
                  onChange={(e) => updateReportField("submitterPhone", e.target.value)}
                  placeholder="Không bắt buộc"
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Thiết bị ── */}
        <Card
          size="small"
          style={{ marginBottom: 20, borderRadius: 14, background: "#fafafe", border: "1px solid #f1f5f9" }}
          styles={{ body: { padding: 18 } }}
        >
          <Flex justify="space-between" align="center" style={{ marginBottom: 14 }}>
            <Text strong style={{ fontSize: 13, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <CameraOutlined style={{ marginRight: 6 }} />
              Thiết bị liên quan
            </Text>
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addEquipmentItem}
              disabled={equipmentItems.length >= MAX_EQUIPMENT_ITEMS}
            >
              Thêm máy
            </Button>
          </Flex>

          {equipmentItems.map((item, index) => (
            <Row key={index} gutter={10} style={{ marginBottom: index < equipmentItems.length - 1 ? 10 : 0 }}>
              <Col flex="1">
                <Input
                  value={item.deviceName}
                  onChange={(e) => updateEquipmentItem(index, "deviceName", e.target.value)}
                  placeholder="Tên máy (Canon R6, Sony A7IV...)"
                  prefix={<CameraOutlined style={{ color: "#94a3b8" }} />}
                />
              </Col>
              <Col flex="1">
                <Input
                  value={item.serialNumber}
                  onChange={(e) => updateEquipmentItem(index, "serialNumber", e.target.value)}
                  placeholder="Số seri"
                  prefix={<NumberOutlined style={{ color: "#94a3b8" }} />}
                />
              </Col>
              <Col flex="none">
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeEquipmentItem(index)}
                  disabled={equipmentItems.length === 1}
                />
              </Col>
            </Row>
          ))}
        </Card>

        {/* ── Nội dung ── */}
        <Form.Item label="Nội dung tố cáo" required>
          <Input.TextArea
            rows={5}
            value={reportForm.description}
            onChange={(e) => updateReportField("description", e.target.value)}
            placeholder="Mô tả cách thức lừa đảo, thời gian, thiết bị, link chat, bằng chứng..."
            showCount
            style={{ borderRadius: 14 }}
          />
        </Form.Item>

        {/* ── Upload ── */}
        <Form.Item label="Ảnh bằng chứng">
          <div className="premium-upload">
            <Upload.Dragger
              multiple
              accept="image/*"
              fileList={reportImages}
              onChange={handleImageChange}
              beforeUpload={() => false}
              maxCount={MAX_IMAGES}
              listType="picture"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text" style={{ fontWeight: 600 }}>
                Kéo thả ảnh vào đây hoặc click để chọn
              </p>
              <p className="ant-upload-hint">
                Tối đa {MAX_IMAGES} ảnh, mỗi ảnh ≤ {MAX_IMAGE_MB}MB
              </p>
            </Upload.Dragger>
          </div>
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          block
          icon={<SendOutlined />}
          loading={isSubmitting}
          className="submit-btn"
        >
          {isSubmitting ? "Đang gửi..." : "Gửi tố cáo"}
        </Button>
      </Form>

      {reportError && (
        <Alert type="error" message={reportError} showIcon closable onClose={() => setReportError("")} style={{ marginTop: 16, borderRadius: 12 }} />
      )}
      {reportSuccess && (
        <Alert type="success" message={reportSuccess} showIcon closable onClose={() => setReportSuccess("")} style={{ marginTop: 16, borderRadius: 12 }} />
      )}
    </div>
  );

  /* ══════════════════════════════════════════
     ALL REPORTS PANEL
     ══════════════════════════════════════════ */

  const allReportsPanel = (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <span className="kicker">Cơ sở dữ liệu cộng đồng</span>
        <Title level={4} style={{ margin: 0 }}>
          Tất cả tố cáo scam
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Danh sách toàn bộ tố cáo đã được ghi nhận trong hệ thống
        </Text>
      </div>

      {reports.length === 0 ? (
        <Empty
          description="Chưa có dữ liệu tố cáo nào"
          style={{ padding: "60px 0" }}
        />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {paginatedReports.map((item) => (
              <Col xs={24} md={12} key={item.id}>
                <ReportCard item={item} onViewDetail={setSelectedReport} />
              </Col>
            ))}
          </Row>

          <Flex justify="center" style={{ marginTop: 24 }}>
            <Pagination
              current={homePage}
              total={reports.length}
              pageSize={HOME_REPORTS_PER_PAGE}
              onChange={setHomePage}
              showSizeChanger={false}
              showTotal={(total) => (
                <Text type="secondary" style={{ fontSize: 13 }}>{total} tố cáo</Text>
              )}
            />
          </Flex>
        </>
      )}
    </div>
  );

  /* ══════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════ */

  return (
    <Layout style={{ minHeight: "100vh", background: "transparent" }}>
      {contextHolder}
      <div className="app-bg" />

      <Content
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1360,
          margin: "0 auto",
          width: "100%",
          padding: screens.md ? "36px 28px 0" : "20px 14px 0",
        }}
      >
        {/* ══ HERO ══ */}
        <Card
          className="hero-card"
          style={{ borderRadius: 24, marginBottom: 28 }}
          styles={{ body: { padding: screens.md ? 36 : 22, position: "relative", zIndex: 1 } }}
        >
          <div className="hero-badge">
            <SafetyCertificateOutlined />
            Camera Rental Safety
          </div>

          <Title
            level={screens.md ? 1 : 2}
            className="hero-title"
          >
            Check scam CCCD khi thuê máy ảnh
          </Title>

          <Paragraph type="secondary" className="hero-subtitle">
            Hệ thống phi lợi nhuận giúp các shop cho thuê máy ảnh kiểm tra
            rủi ro scam trước khi giao máy. Tra cứu nhanh lịch sử tố cáo để
            giảm thiểu thất thoát.
          </Paragraph>

          <div className="hero-stats-row">
            <Card size="small" className="hero-stat-card" style={{ borderRadius: 14 }}>
              <Statistic
                title="Tổng tố cáo"
                value={totalReports}
                prefix={<AlertOutlined style={{ color: "#4f46e5" }} />}
                valueStyle={{ fontWeight: 800, color: "#0f172a" }}
              />
            </Card>
            <Card size="small" className="hero-stat-card" style={{ borderRadius: 14 }}>
              <Statistic
                title="Đối tượng"
                value={new Set(reports.map((r) => r.cccd)).size}
                prefix={<IdcardOutlined style={{ color: "#06b6d4" }} />}
                valueStyle={{ fontWeight: 800, color: "#0f172a" }}
              />
            </Card>
            <Card size="small" className="hero-stat-card" style={{ borderRadius: 14 }}>
              <Statistic
                title="Bằng chứng"
                value={reports.reduce((s, r) => s + (r.imageUrls?.length ?? 0), 0)}
                prefix={<PictureOutlined style={{ color: "#8b5cf6" }} />}
                valueStyle={{ fontWeight: 800, color: "#0f172a" }}
              />
            </Card>
          </div>
        </Card>

        {/* ══ ERRORS / LOADING ══ */}
        {dataError && (
          <Alert
            type="error"
            message={dataError}
            showIcon
            style={{ marginBottom: 20, borderRadius: 14 }}
          />
        )}

        {isLoadingReports && (
          <Card style={{ textAlign: "center", marginBottom: 24, borderRadius: 16 }}>
            <Spin size="large" />
            <Paragraph type="secondary" style={{ marginTop: 14, marginBottom: 0 }}>
              Đang tải dữ liệu...
            </Paragraph>
          </Card>
        )}

        {/* ══ MAIN CONTENT ══ */}
        <Card
          className="glass-card"
          style={{ borderRadius: 20 }}
          styles={{ body: { padding: screens.md ? 28 : 18 } }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            className="premium-tabs"
            items={[
              {
                key: "all",
                label: (
                  <Space>
                    <DatabaseOutlined />
                    <span>Tất cả tố cáo</span>
                  </Space>
                ),
                children: allReportsPanel,
              },
              {
                key: "check",
                label: (
                  <Space>
                    <SearchOutlined />
                    <span>Tra cứu</span>
                  </Space>
                ),
                children: searchPanel,
              },
              {
                key: "report",
                label: (
                  <Space>
                    <SendOutlined />
                    <span>Gửi tố cáo</span>
                  </Space>
                ),
                children: reportPanel,
              },
            ]}
          />
        </Card>
      </Content>

      {/* ══ FOOTER ══ */}
      <div className="app-footer">
        <Text className="footer-brand">
          <SafetyCertificateOutlined style={{ marginRight: 6 }} />
          Camera Rental Safety
        </Text>
        <Paragraph className="footer-sub">
          Hệ thống phi lợi nhuận bảo vệ cộng đồng cho thuê máy ảnh
        </Paragraph>
      </div>

      {/* ══ DETAIL MODAL ══ */}
      <ReportDetailModal
        report={selectedReport}
        open={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
      />
    </Layout>
  );
}

export default App;
