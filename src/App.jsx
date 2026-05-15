import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Layout,
  Card,
  Carousel,
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
  ScanOutlined,
  UploadOutlined,
  LeftOutlined,
  RightOutlined,
  SwapOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import "./App.css";
import {
  createReport,
  fetchReports,
  hasApiConfig,
  uploadEvidenceFile,
} from "./api";
import CccdScanner from "./components/CccdScanner";
import { scanCccdImage } from "./ocr";

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
        <Col xs={12} sm={compact ? 24 : 8}>
          <div className="report-card-field">
            <span className="report-card-field-label">CCCD</span>
            <span className="report-card-field-value">{item.cccd}</span>
          </div>
        </Col>
        <Col xs={12} sm={compact ? 24 : 8}>
          <div className="report-card-field">
            <span className="report-card-field-label">SĐT đối tượng</span>
            <span className="report-card-field-value">{item.scammerPhone?.trim() || "—"}</span>
          </div>
        </Col>
        {hasSubmitterInfo(item) && (
          <Col xs={24} sm={compact ? 24 : 8}>
            <div className="report-card-field">
              <span className="report-card-field-label">Người đăng</span>
              <span className="report-card-field-value">{item.submitterName?.trim() || "—"}</span>
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
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isQuickScanning, setIsQuickScanning] = useState(false);
  const [quickScanError, setQuickScanError] = useState("");
  const [quickScanResult, setQuickScanResult] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const uploadInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const carouselRef = useRef(null);

  useEffect(() => {
    setCarouselIndex(0);
    if (carouselRef.current && typeof carouselRef.current.goTo === "function") {
      carouselRef.current.goTo(0, true);
    }
  }, [searchResult]);

  const handleScannerApply = useCallback(
    (data) => {
      if (!data) return;
      setReportForm((prev) => ({
        ...prev,
        ...(data.cccd ? { cccd: data.cccd } : {}),
        ...(data.fullName ? { scammerName: data.fullName } : {}),
      }));
      const filled = [data.cccd && "số CCCD", data.fullName && "họ tên"]
        .filter(Boolean)
        .join(" và ");
      if (filled) {
        setReportError("");
        messageApi.success(
          `AI đã điền ${filled} vào biểu mẫu. Kiểm tra lại trước khi gửi.`,
        );
      }
    },
    [messageApi],
  );

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

  // Quick-scan inline: nhận file (từ upload hoặc camera capture), chạy OCR,
  // tự tra cứu CCCD + tên theo OR và hiển thị kết quả ngay trong tab Tra cứu.
  const runQuickScan = useCallback(
    async (file) => {
      if (!file) return;
      if (!file.type?.startsWith("image/")) {
        setQuickScanError("File không phải ảnh.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setQuickScanError("Ảnh quá lớn (>10MB).");
        return;
      }
      setQuickScanError("");
      setQuickScanResult(null);
      setIsQuickScanning(true);
      try {
        const data = await scanCccdImage(file);
        const cccd = (data.cccd ?? "").trim();
        const name = (data.fullName ?? "").trim();
        setQuickScanResult({ cccd, fullName: name });

        if (!cccd && !name) {
          setQuickScanError(
            "AI không đọc được CCCD hay họ tên. Hãy chụp lại rõ nét, đủ ánh sáng.",
          );
          return;
        }

        // Tra cứu theo CCCD HOẶC họ tên — merge và khử trùng theo id.
        const matchesByCccd = cccd ? findMatches(cccd) : [];
        const matchesByName = name ? findMatches(name) : [];
        const seen = new Set();
        const merged = [...matchesByCccd, ...matchesByName].filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });

        setSearchError("");
        setQueryKeyword(cccd || name);
        setSearchResult(merged);
        setSelectedReport(null);
        setActiveTab("check");
        setTimeout(() => {
          document.getElementById("search-results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);

        if (merged.length > 0) {
          messageApi.warning({
            content: `Cảnh báo: tìm thấy ${merged.length} tố cáo khớp ${cccd ? `CCCD ${cccd}` : ""}${cccd && name ? " hoặc " : ""}${name ? `tên "${name}"` : ""}.`,
            duration: 6,
          });
        } else {
          messageApi.success({
            content: `Đã quét: ${cccd ? `CCCD ${cccd}` : ""}${cccd && name ? " · " : ""}${name ? `tên ${name}` : ""}. Không có tố cáo nào — tạm thời an toàn.`,
            duration: 5,
          });
        }
      } catch (err) {
        setQuickScanError(
          err instanceof Error ? `Lỗi OCR: ${err.message}` : "Lỗi không xác định.",
        );
      } finally {
        setIsQuickScanning(false);
      }
    },
    [findMatches, messageApi],
  );

  const handleQuickScanInput = (event) => {
    const file = event.target.files?.[0];
    if (file) runQuickScan(file);
    event.target.value = "";
  };

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
    setTimeout(() => {
      document.getElementById("search-results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
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
      <div className="hero-section">
        <div className="hero-badge"><SearchOutlined /> Kiểm tra rủi ro</div>
        <h1 className="hero-title">Tra cứu Scam<br/>nhanh chóng</h1>
        <p className="hero-subtitle">
          Nhập CCCD, SĐT hoặc quét AI để kiểm tra mức độ an toàn trước khi giao máy.
        </p>
      </div>

      {/* ── AI Scanner Hero — mobile-first ── */}
      <div className="ai-hero" style={{ marginBottom: 16 }}>

        <Flex
          align="center"
          gap={10}
          style={{ marginBottom: 8, position: "relative", zIndex: 1 }}
        >
          <div
            style={{
              width: screens.md ? 36 : 32,
              height: screens.md ? 36 : 32,
              borderRadius: 10,
              background: "rgba(255,255,255,0.18)",
              display: "grid",
              placeItems: "center",
              backdropFilter: "blur(6px)",
              flexShrink: 0,
            }}
          >
            <ThunderboltOutlined
              style={{ fontSize: screens.md ? 18 : 16, color: "#fff" }}
            />
          </div>
          <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
            <Text
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 10.5,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 700,
                display: "block",
              }}
            >
              AI Scanner · Quét nhanh
            </Text>
            <Title
              level={5}
              style={{
                color: "#fff",
                margin: 0,
                fontWeight: 700,
                lineHeight: 1.25,
                fontSize: screens.md ? 20 : 17,
              }}
            >
              Tra cứu CCCD/VNeID tức thì
            </Title>
          </div>
        </Flex>

        <Text
          style={{
            display: "block",
            color: "rgba(255,255,255,0.82)",
            fontSize: 13,
            lineHeight: 1.5,
            marginBottom: 14,
            position: "relative",
            zIndex: 1,
            textAlign: "left",
          }}
        >
          Chọn ảnh hoặc chụp CCCD — AI đọc{" "}
          <Text strong style={{ color: "#fff" }}>
            số CCCD
          </Text>{" "}
          và{" "}
          <Text strong style={{ color: "#fff" }}>
            họ tên
          </Text>{" "}
          rồi tự tra cứu ngay.
        </Text>

        <Flex
          gap={8}
          style={{ position: "relative", zIndex: 1 }}
        >
          <Button
            size="large"
            icon={<UploadOutlined />}
            loading={isQuickScanning}
            onClick={() => uploadInputRef.current?.click()}
            className="ai-hero-btn-primary"
            style={{ flex: 1 }}
          >
            Tải ảnh
          </Button>
          <Button
            size="large"
            icon={<CameraOutlined />}
            disabled={isQuickScanning}
            onClick={() => cameraInputRef.current?.click()}
            className="ai-hero-btn-secondary"
            style={{ flex: 1 }}
          >
            Quét nhanh
          </Button>
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            onChange={handleQuickScanInput}
            style={{ display: "none" }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleQuickScanInput}
            style={{ display: "none" }}
          />
        </Flex>

        {(isQuickScanning || quickScanResult || quickScanError) && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.3)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              position: "relative",
              zIndex: 1,
            }}
          >
            {isQuickScanning && (
              <Flex align="center" gap={8}>
                <Spin size="small" />
                <Text
                  style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 600 }}
                >
                  AI đang đọc ảnh và tra cứu...
                </Text>
              </Flex>
            )}
            {!isQuickScanning && quickScanError && (
              <Alert
                type="warning"
                showIcon
                message={
                  <Text style={{ fontSize: 12.5 }}>{quickScanError}</Text>
                }
                style={{ marginBottom: 0, borderRadius: 8, padding: "6px 10px" }}
              />
            )}
            {!isQuickScanning && !quickScanError && quickScanResult && (
              <Flex wrap gap={6} align="center">
                {quickScanResult.cccd && (
                  <Tag
                    color="geekblue"
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12.5,
                      padding: "2px 8px",
                      borderRadius: 6,
                      marginInlineEnd: 0,
                    }}
                  >
                    <IdcardOutlined /> {quickScanResult.cccd}
                  </Tag>
                )}
                {quickScanResult.fullName && (
                  <Tag
                    color="purple"
                    style={{
                      fontSize: 12.5,
                      padding: "2px 8px",
                      borderRadius: 6,
                      marginInlineEnd: 0,
                    }}
                  >
                    <UserOutlined /> {quickScanResult.fullName}
                  </Tag>
                )}
                {!quickScanResult.cccd && !quickScanResult.fullName && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Không đọc được dữ liệu
                  </Text>
                )}
              </Flex>
            )}
          </div>
        )}
      </div>

      <Divider
        style={{
          margin: screens.md ? "12px 0 16px" : "8px 0 12px",
          color: "var(--text-tertiary)",
          fontSize: 12,
        }}
      >
        hoặc nhập thủ công
      </Divider>

      <div
        className="premium-search"
        style={{ marginBottom: screens.md ? 20 : 14 }}
      >
        <Input.Search
          size="large"
          value={queryKeyword}
          onChange={(e) => setQueryKeyword(e.target.value)}
          onSearch={handleCheck}
          placeholder={
            screens.md
              ? "Nhập CCCD, số điện thoại hoặc tên..."
              : "CCCD, SĐT hoặc tên..."
          }
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
        <div id="search-results-section" className="fade-in">
          {/* Safety status hero — thay đổi màu sắc theo mức độ rủi ro */}
          {(() => {
            const isSafe = searchResult.length === 0;
            const isHigh = searchResult.length >= 3;
            const containerClass = isSafe ? "status-safe" : isHigh ? "status-high" : "status-warning";
            const heroIconColor = isSafe ? "var(--success)" : isHigh ? "var(--danger)" : "var(--warning)";
            const heroIcon = isSafe ? (
              <CheckCircleOutlined style={{ fontSize: 28 }} />
            ) : isHigh ? (
              <FireOutlined style={{ fontSize: 28 }} />
            ) : (
              <WarningOutlined style={{ fontSize: 28 }} />
            );
            const heroTitle = isSafe
              ? "An toàn tạm thời"
              : isHigh
                ? "Rủi ro cao — Hãy cẩn trọng!"
                : "Có cảnh báo";
            const heroSub = isSafe
              ? "Chưa có tố cáo nào với thông tin này."
              : `Tìm thấy ${searchResult.length} tố cáo${isHigh ? " — đối tượng nhiều lần bị tố giác" : ""}.`;
            return (
              <div
                className={containerClass}
                style={{
                  padding: screens.md ? "20px 22px" : "14px 14px",
                  borderRadius: 16,
                  marginBottom: 12,
                }}
              >
                <Flex align="center" gap={12}>
                  <div
                    style={{
                      width: screens.md ? 52 : 44,
                      height: screens.md ? 52 : 44,
                      borderRadius: 14,
                      background: "rgba(0,0,0,0.2)",
                      color: heroIconColor,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {heroIcon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <Text
                      style={{
                        fontSize: 11.5,
                        color: "var(--text-secondary)",
                        fontWeight: 600,
                        display: "block",
                        lineHeight: 1.3,
                      }}
                    >
                      Tra cứu cho{" "}
                      <Text
                        strong
                        style={{
                          fontFamily: "monospace",
                          color: "var(--text-primary)",
                          fontSize: 12.5,
                        }}
                      >
                        {queryKeyword}
                      </Text>
                    </Text>
                    <Title
                      level={5}
                      style={{
                        margin: "2px 0 0",
                        color: "var(--text-primary)",
                        fontWeight: 700,
                        fontSize: screens.md ? 18 : 16,
                        lineHeight: 1.25,
                      }}
                    >
                      {heroTitle}
                    </Title>
                    <Text
                      style={{
                        fontSize: 12.5,
                        color: "var(--text-secondary)",
                        display: "block",
                        marginTop: 2,
                        lineHeight: 1.4,
                      }}
                    >
                      {heroSub}
                    </Text>
                  </div>
                </Flex>
              </div>
            );
          })()}

          {searchResult.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <Row gutter={[16, 16]}>
                {searchResult.map((item) => (
                  <Col xs={24} md={12} key={item.id}>
                    <ReportCard item={item} onViewDetail={setSelectedReport} />
                  </Col>
                ))}
              </Row>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty-search-state">
          <div className="empty-search-icon">
            <FileSearchOutlined />
          </div>
          <Title level={5} style={{ margin: "0 0 6px", color: "var(--text-secondary)" }}>
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
      <div className="hero-section">
        <div className="hero-badge"><SafetyCertificateOutlined /> Bảo vệ cộng đồng</div>
        <h1 className="hero-title">Gửi tố cáo<br/>scam mới</h1>
        <p className="hero-subtitle">
          Dữ liệu của bạn sẽ giúp những người cho thuê máy khác tránh bị lừa đảo.
        </p>
      </div>

      <Form layout="vertical" onFinish={handleSubmitReport} className="premium-form">
        {/* ── AI Scanner CCCD ── */}
        <Card
          size="small"
          className="glass-card ai-hero"
          style={{
            marginBottom: 20,
            overflow: "hidden",
            position: "relative",
          }}
          styles={{ body: { padding: 18, zIndex: 1, position: "relative" } }}
        >
          <Flex justify="space-between" align="center" wrap gap={12}>
            <Space direction="vertical" size={2} style={{ flex: 1, minWidth: 0 }}>
              <Tag
                color="geekblue"
                icon={<ScanOutlined />}
                style={{ fontWeight: 700, marginInlineEnd: 0 }}
              >
                AI SCANNER
              </Tag>
              <Text strong style={{ fontSize: 15, color: "#fff" }}>
                Quét CCCD/VNeID bằng AI
              </Text>
              <Text style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                Bật camera hoặc tải ảnh — AI tự trích xuất số CCCD và họ tên,
                rồi điền vào biểu mẫu bên dưới.
              </Text>
            </Space>
            <Button
              size="large"
              icon={<ScanOutlined />}
              onClick={() => setIsScannerOpen(true)}
              className="ai-hero-btn-secondary"
            >
              Mở AI Scanner
            </Button>
          </Flex>
        </Card>

        {/* ── Thông tin đối tượng ── */}
        <Card
          size="small"
          className="glass-card"
          style={{ marginBottom: 20 }}
          styles={{ body: { padding: 18 } }}
        >
          <Text strong style={{ fontSize: 13, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 14 }}>
            <SafetyOutlined style={{ marginRight: 6 }} />
            Thông tin đối tượng bị tố cáo
          </Text>

          <Form.Item label="CCCD (12 chữ số)" required style={{ marginBottom: 14 }}>
            <Input
              prefix={<IdcardOutlined style={{ color: "var(--text-tertiary)" }} />}
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
                  prefix={<UserOutlined style={{ color: "var(--text-tertiary)" }} />}
                  value={reportForm.scammerName}
                  onChange={(e) => updateReportField("scammerName", e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="SĐT đối tượng" style={{ marginBottom: 0 }}>
                <Input
                  prefix={<PhoneOutlined style={{ color: "var(--text-tertiary)" }} />}
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
          className="glass-card"
          style={{ marginBottom: 20 }}
          styles={{ body: { padding: 18 } }}
        >
          <Text strong style={{ fontSize: 13, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 14 }}>
            <TeamOutlined style={{ marginRight: 6 }} />
            Thông tin người đăng (không bắt buộc)
          </Text>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Họ tên bạn" style={{ marginBottom: 0 }}>
                <Input
                  prefix={<UserOutlined style={{ color: "var(--text-tertiary)" }} />}
                  value={reportForm.submitterName}
                  onChange={(e) => updateReportField("submitterName", e.target.value)}
                  placeholder="Tên của bạn"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="SĐT liên hệ" style={{ marginBottom: 0 }}>
                <Input
                  prefix={<PhoneOutlined style={{ color: "var(--text-tertiary)" }} />}
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
          className="glass-card"
          style={{ marginBottom: 20 }}
          styles={{ body: { padding: 18 } }}
        >
          <Flex justify="space-between" align="center" style={{ marginBottom: 14 }}>
            <Text strong style={{ fontSize: 13, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
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
                  prefix={<CameraOutlined style={{ color: "var(--text-tertiary)" }} />}
                />
              </Col>
              <Col flex="1">
                <Input
                  value={item.serialNumber}
                  onChange={(e) => updateEquipmentItem(index, "serialNumber", e.target.value)}
                  placeholder="Số seri"
                  prefix={<NumberOutlined style={{ color: "var(--text-tertiary)" }} />}
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
      <div className="hero-section">
        <div className="hero-badge"><DatabaseOutlined /> Dữ liệu mở</div>
        <h1 className="hero-title">Cơ sở dữ liệu<br/>Scammer</h1>
        <p className="hero-subtitle">
          Danh sách đen được đóng góp bởi cộng đồng cho thuê máy ảnh trên toàn quốc.
        </p>
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

  return <>
    <Layout style={{ minHeight: "100vh", background: "transparent", paddingBottom: 80 }}>
      {contextHolder}
      <div className="bg-grid" />
      <div className="app-bg" />

      {/* ══ HEADER ══ */}
      <header className="app-header">
        <div className="brand-logo">
          <SafetyCertificateOutlined style={{ fontSize: 24, color: 'var(--primary)' }} />
          ScamChecker
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
          <SafetyOutlined /> BẢO VỆ CỘNG ĐỒNG
        </div>
      </header>

      <Content
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1200,
          margin: "0 auto",
          width: "100%",
          padding: screens.md ? "24px 20px" : "20px 14px",
        }}
      >
        <motion.div
           key={activeTab}
           initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
           animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
           transition={{ duration: 0.3 }}
        >
          {activeTab === "all" && allReportsPanel}
          {activeTab === "check" && searchPanel}
          {activeTab === "report" && reportPanel}
        </motion.div>
      </Content>

      {/* ══ DETAIL MODAL ══ */}
      <ReportDetailModal
        report={selectedReport}
        open={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
      />

      {/* ══ AI SCANNER MODAL (report tab) ══ */}
      <CccdScanner
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onApply={handleScannerApply}
      />
    </Layout>

    {/* ══ BOTTOM NAVIGATION ══ */}
    <nav className="mobile-nav">
      <button
        className={`nav-item ${activeTab === 'all' ? 'active' : ''}`}
        onClick={() => setActiveTab('all')}
      >
        <div className="icon-wrapper"><DatabaseOutlined /></div>
        <span>Dữ liệu</span>
      </button>
      
      <button
        className={`nav-item ${activeTab === 'check' ? 'active' : ''}`}
        onClick={() => setActiveTab('check')}
      >
        <div className="icon-wrapper"><SearchOutlined /></div>
        <span>Tra cứu</span>
      </button>
      
      <button
        className={`nav-item ${activeTab === 'report' ? 'active' : ''}`}
        onClick={() => setActiveTab('report')}
      >
        <div className="icon-wrapper"><SendOutlined /></div>
        <span>Tố cáo</span>
      </button>
    </nav>
  </>;
}

export default App;
