import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Input,
  Button,
  Form,
  Upload,
  Modal,
  Image,
  Pagination,
  Alert,
  Spin,
  Flex,
  message,
} from "antd";
import {
  SearchOutlined,
  SendOutlined,
  IdcardOutlined,
  PhoneOutlined,
  UserOutlined,
  CameraOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  PictureOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  FileSearchOutlined,
  ClockCircleOutlined,
  NumberOutlined,
  FireOutlined,
  TeamOutlined,
  DatabaseOutlined,
  ScanOutlined,
  UploadOutlined,
  ReloadOutlined,
  UserOutlined as AccountIcon,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import "./App.css";
import {
  createReport,
  fetchReports,
  hasApiConfig,
  uploadEvidenceFile,
} from "./api";
import CccdScanner from "./components/CccdScanner";
import AccountPanel from "./components/AccountPanel";
import NoticeModal from "./components/NoticeModal";
import { useAuth } from "./auth-context";
import { scanCccdImage } from "./ocr";

const MAX_IMAGES = 6;
const MAX_IMAGE_MB = 5;
const MAX_EQUIPMENT_ITEMS = 10;
const HOME_REPORTS_PER_PAGE = 6;
const EMPTY_VALUE = "Không có";

/*
  Tab cuối đổi tên theo trạng thái: người chưa đăng nhập thấy "Xác thực" để
  biết cần làm gì, người đã đăng nhập thấy "Tài khoản".
*/
const buildTabs = (isSignedIn) => [
  { key: "all", label: "Dữ liệu", icon: <DatabaseOutlined /> },
  { key: "check", label: "Tra cứu", icon: <SearchOutlined /> },
  { key: "report", label: "Tố cáo", icon: <SendOutlined /> },
  isSignedIn
    ? { key: "account", label: "Tài khoản", icon: <AccountIcon /> }
    : { key: "account", label: "Xác thực", icon: <SafetyCertificateOutlined /> },
];

const createEmptyEquipmentItem = () => ({ deviceName: "", serialNumber: "" });

const isValidCccd = (value) => /^\d{12}$/.test(value);
const normalizeSearchText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/*
  Tự dựng chuỗi thay vì dùng Intl: locale vi-VN trả về giờ trước ngày
  ("19:13 23/09/2026"), trong khi danh sách cần ngày đứng trước để quét mắt.
*/
const pad = (n) => String(n).padStart(2, "0");
const formatDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Không rõ thời gian";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

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

/* ── Khối nhỏ dùng lại ────────────────────── */

function Field({ label, value, mono }) {
  const isEmpty = !String(value ?? "").trim();
  return (
    <div>
      <span className="field-label">{label}</span>
      <span
        className={[
          "field-value",
          mono && !isEmpty ? "num" : "",
          isEmpty ? "is-empty" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isEmpty ? EMPTY_VALUE : value}
      </span>
    </div>
  );
}

function DeviceChip({ item }) {
  return (
    <span className="device-chip">
      <CameraOutlined />
      {item.deviceName}
      <span className="device-sn">{item.serialNumber}</span>
    </span>
  );
}

function EvidenceThumbs({ report, size = 76 }) {
  return (
    <Image.PreviewGroup>
      <div className="thumb-row">
        {report.imageUrls.map((url, idx) => (
          <Image
            key={url}
            src={url}
            alt={`Ảnh bằng chứng ${idx + 1} trong tố cáo ${
              report.scammerName || "không rõ đối tượng"
            }`}
            width={size}
            height={Math.round(size * 0.75)}
            style={{ objectFit: "cover" }}
            placeholder
          />
        ))}
      </div>
    </Image.PreviewGroup>
  );
}

function EmptyState({ icon, title, children }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

/* Khung xám đúng hình dạng card thật, nên dữ liệu về không làm nhảy layout */
function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="sk" style={{ width: "54%", height: 16 }} />
      <div className="sk" style={{ width: "32%", height: 11, marginTop: 10 }} />
      <div className="sk-row" style={{ marginTop: 22 }}>
        <div className="sk" style={{ flex: 1, height: 32 }} />
        <div className="sk" style={{ flex: 1, height: 32 }} />
      </div>
      <div className="sk" style={{ height: 11, marginTop: 20 }} />
      <div className="sk" style={{ width: "74%", height: 11, marginTop: 8 }} />
    </div>
  );
}

function SkeletonGrid({ count = 4 }) {
  return (
    <div className="card-grid">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/* ── Modal chi tiết ───────────────────────── */

function ReportDetailModal({ report, open, onClose }) {
  if (!report) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      title={
        <div>
          <h2 style={{ fontSize: 18 }}>
            {report.scammerName || "Không rõ đối tượng"}
          </h2>
          <span className="report-card-date">
            <ClockCircleOutlined style={{ marginRight: 5 }} />
            {formatDate(report.createdAt)}
          </span>
        </div>
      }
    >
      <div className="detail-block">
        <div className="field-grid" style={{ marginTop: 0, paddingTop: 0, border: 0 }}>
          <Field label="CCCD" value={report.cccd} mono />
          <Field label="Số điện thoại đối tượng" value={report.scammerPhone} mono />
          {hasSubmitterInfo(report) && (
            <>
              <Field label="Người đăng" value={report.submitterName} />
              <Field label="Số điện thoại người đăng" value={report.submitterPhone} mono />
            </>
          )}
        </div>
      </div>

      <div className="detail-block">
        <span className="detail-label">
          <ExclamationCircleOutlined style={{ marginRight: 6 }} />
          Nội dung tố cáo
        </span>
        <p className="detail-text">
          {report.description?.trim() || "Người đăng không ghi nội dung."}
        </p>
      </div>

      {report.equipmentItems?.length > 0 && (
        <div className="detail-block">
          <span className="detail-label">
            <CameraOutlined style={{ marginRight: 6 }} />
            Thiết bị liên quan
          </span>
          <Flex wrap gap={8}>
            {report.equipmentItems.map((item, idx) => (
              <DeviceChip key={idx} item={item} />
            ))}
          </Flex>
        </div>
      )}

      <div className="detail-block">
        <span className="detail-label">
          <PictureOutlined style={{ marginRight: 6 }} />
          Ảnh bằng chứng
        </span>
        {report.imageUrls?.length > 0 ? (
          <EvidenceThumbs report={report} size={132} />
        ) : (
          <p className="hint" style={{ margin: 0 }}>
            Tố cáo này không kèm ảnh bằng chứng.
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ── Card tố cáo ──────────────────────────── */

function ReportCard({ item, onViewDetail }) {
  return (
    <article className="report-card">
      <div className="report-card-top">
        <div style={{ minWidth: 0 }}>
          <h3 className="report-card-name">{item.scammerName || "Không rõ đối tượng"}</h3>
          <div className="report-card-date">
            <ClockCircleOutlined style={{ marginRight: 5 }} />
            {formatDate(item.createdAt)}
          </div>
        </div>
        {onViewDetail && (
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onViewDetail(item)}
          >
            Chi tiết
          </Button>
        )}
      </div>

      <div className="field-grid">
        <Field label="CCCD" value={item.cccd} mono />
        <Field label="Số điện thoại" value={item.scammerPhone} mono />
        {hasSubmitterInfo(item) && (
          <Field label="Người đăng" value={item.submitterName} />
        )}
      </div>

      {item.description?.trim() && (
        <p className="report-card-desc">{item.description}</p>
      )}

      {(item.equipmentItems?.length > 0 || item.imageUrls?.length > 0) && (
        <div className="report-card-foot">
          {item.equipmentItems?.length > 0 && (
            <Flex wrap gap={7} style={{ marginBottom: item.imageUrls?.length ? 10 : 0 }}>
              {item.equipmentItems.map((eq, idx) => (
                <DeviceChip key={idx} item={eq} />
              ))}
            </Flex>
          )}
          {item.imageUrls?.length > 0 && <EvidenceThumbs report={item} />}
        </div>
      )}
    </article>
  );
}

/* ══════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════ */

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const { isSignedIn } = useAuth();
  const tabs = useMemo(() => buildTabs(isSignedIn), [isSignedIn]);

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
  const uploadInputRef = useRef(null);
  const cameraInputRef = useRef(null);

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
          `Đã điền ${filled} vào biểu mẫu. Kiểm tra lại trước khi gửi.`,
        );
      }
    },
    [messageApi],
  );

  /* ── Tải dữ liệu ─────────────────────────── */

  const loadReports = useCallback(async () => {
    const data = await fetchReports();
    const normalizedReports = (data ?? [])
      .map(normalizeReport)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
    setReports(normalizedReports);
  }, []);

  /* Dùng chung cho lần tải đầu và cho nút thử lại khi API lỗi */
  const refreshReports = useCallback(async () => {
    if (!hasApiConfig) {
      setDataError(
        "Chưa cấu hình API. Tạo file .env từ .env.example và khai báo VITE_API_BASE_URL.",
      );
      setIsLoadingReports(false);
      return;
    }
    setIsLoadingReports(true);
    try {
      await loadReports();
      setDataError("");
    } catch (error) {
      setDataError(
        error instanceof Error
          ? error.message
          : "Không đọc được dữ liệu từ API.",
      );
    } finally {
      setIsLoadingReports(false);
    }
  }, [loadReports]);

  useEffect(() => {
    refreshReports();
  }, [refreshReports]);

  /* ── Tra cứu ─────────────────────────────── */

  const findMatches = useCallback(
    (keyword) => {
      const norm = normalizeSearchText(keyword);
      const digits = String(keyword ?? "").replace(/\D/g, "");
      if (!norm) return [];
      return reports.filter((item) => {
        const fields = [
          item.cccd,
          item.scammerPhone,
          item.submitterPhone,
          item.scammerName,
          item.submitterName,
        ];
        const textMatch = fields.some((f) =>
          normalizeSearchText(f).includes(norm),
        );
        const digitMatch = digits
          ? [item.cccd, item.scammerPhone, item.submitterPhone].some((f) =>
              String(f ?? "")
                .replace(/\D/g, "")
                .includes(digits),
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

  // Quét nhanh: nhận file từ upload hoặc camera, chạy OCR, tự tra cứu CCCD và
  // tên theo OR rồi hiển thị kết quả ngay trong tab Tra cứu.
  const runQuickScan = useCallback(
    async (file) => {
      if (!file) return;
      if (!file.type?.startsWith("image/")) {
        setQuickScanError("File không phải ảnh.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setQuickScanError("Ảnh quá lớn, giới hạn 10MB.");
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
            "Không đọc được CCCD hay họ tên. Hãy chụp lại rõ nét, đủ ánh sáng.",
          );
          return;
        }

        // Tra cứu theo CCCD hoặc họ tên, merge và khử trùng theo id.
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
          document
            .getElementById("search-results-section")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);

        const scanned = cccd ? `CCCD ${cccd}` : `tên ${name}`;
        if (merged.length > 0) {
          messageApi.warning({
            content: `Tìm thấy ${merged.length} tố cáo khớp ${scanned}.`,
            duration: 6,
          });
        } else {
          messageApi.success({
            content: `Đã quét ${scanned}. Chưa có tố cáo nào.`,
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

  const totalHomePages = useMemo(
    () => Math.max(1, Math.ceil(reports.length / HOME_REPORTS_PER_PAGE)),
    [reports.length],
  );
  const paginatedReports = useMemo(() => {
    const start = (homePage - 1) * HOME_REPORTS_PER_PAGE;
    return reports.slice(start, start + HOME_REPORTS_PER_PAGE);
  }, [homePage, reports]);

  /* ── Handler ─────────────────────────────── */

  const handleCheck = () => {
    setSearchError("");
    if (!queryKeyword.trim()) {
      setSearchResult(null);
      setSelectedReport(null);
      setSearchError("Nhập CCCD, số điện thoại hoặc tên để tra cứu.");
      return;
    }
    setSearchResult(findMatches(queryKeyword));
    setSelectedReport(null);
    setTimeout(() => {
      document
        .getElementById("search-results-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      setReportError(
        `File ${bad.name} không hợp lệ. Chỉ nhận ảnh tối đa ${MAX_IMAGE_MB}MB.`,
      );
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

    if (!hasApiConfig) {
      setReportError("API chưa cấu hình.");
      return;
    }
    if (!isValidCccd(reportForm.cccd)) {
      setReportError("CCCD phải đúng 12 chữ số.");
      return;
    }
    if (!reportForm.description.trim()) {
      setReportError("Nhập nội dung tố cáo.");
      return;
    }

    const trimmed = equipmentItems
      .map((i) => ({
        deviceName: i.deviceName.trim(),
        serialNumber: i.serialNumber.trim(),
      }))
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
      setReportForm({
        cccd: "",
        scammerName: "",
        scammerPhone: "",
        submitterName: "",
        submitterPhone: "",
        description: "",
      });
      setReportImages([]);
      setEquipmentItems([createEmptyEquipmentItem()]);
      setReportSuccess("Tố cáo đã được ghi nhận.");
      messageApi.success("Tố cáo đã được ghi nhận.");
    } catch (error) {
      setReportError(
        `Gửi thất bại: ${
          error instanceof Error ? error.message : "Lỗi không xác định"
        }`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Tab: cơ sở dữ liệu ──────────────────── */

  const dataErrorBanner = dataError ? (
    <Alert
      type="error"
      showIcon
      message="Không tải được dữ liệu"
      description={dataError}
      action={
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={refreshReports}
          loading={isLoadingReports}
        >
          Thử lại
        </Button>
      }
      style={{ marginBottom: 18 }}
    />
  ) : null;

  const allReportsPanel = (
    <div className="tab-panel">
      <header className="page-head">
        <h1>Cơ sở dữ liệu scammer</h1>
        <p>
          Danh sách do cộng đồng cho thuê máy ảnh trên toàn quốc đóng góp. Tra
          cứu trước khi giao máy cho khách lạ.
        </p>
        {!isLoadingReports && !dataError && reports.length > 0 && (
          <div className="page-head-meta">
            <strong>{reports.length}</strong>
            <span>tố cáo đã ghi nhận</span>
          </div>
        )}
      </header>

      {dataErrorBanner}

      {isLoadingReports ? (
        <SkeletonGrid count={4} />
      ) : dataError ? null : reports.length === 0 ? (
        <EmptyState icon={<InboxOutlined />} title="Chưa có tố cáo nào">
          Khi có người gửi tố cáo đầu tiên, dữ liệu sẽ hiện ở đây.
        </EmptyState>
      ) : (
        <>
          <div className="card-grid">
            {paginatedReports.map((item) => (
              <ReportCard
                key={item.id}
                item={item}
                onViewDetail={setSelectedReport}
              />
            ))}
          </div>

          {reports.length > HOME_REPORTS_PER_PAGE && (
            <Flex justify="center" style={{ marginTop: 26 }}>
              <Pagination
                current={homePage}
                total={reports.length}
                pageSize={HOME_REPORTS_PER_PAGE}
                onChange={setHomePage}
                showSizeChanger={false}
              />
            </Flex>
          )}
        </>
      )}
    </div>
  );

  /* ── Tab: tra cứu ────────────────────────── */

  /*
    Chỉ kết luận "cùng một người bị tố cáo nhiều lần" khi các kết quả dùng
    chung một số CCCD. Tra theo tên thường khớp nhiều người khác nhau, nói
    gộp thành một đối tượng là sai.
  */
  const riskView = (() => {
    if (!Array.isArray(searchResult)) return null;
    const count = searchResult.length;
    const distinctSubjects = new Set(
      searchResult.map((r) => String(r.cccd ?? "").trim()).filter(Boolean),
    ).size;
    const sameSubject = distinctSubjects <= 1;

    let level = "none";
    let icon = <CheckCircleOutlined />;
    let title = "Chưa có tố cáo";
    let sub =
      "Không có ghi nhận nào với thông tin này. Vẫn nên kiểm tra giấy tờ gốc khi giao máy.";

    if (count > 0 && sameSubject && count >= 3) {
      level = "high";
      icon = <FireOutlined />;
      title = "Rủi ro cao";
      sub = `Cùng một số CCCD bị tố cáo ${count} lần.`;
    } else if (count > 0 && sameSubject) {
      level = "mid";
      icon = <WarningOutlined />;
      title = "Có tố cáo";
      sub = `Tìm thấy ${count} tố cáo với thông tin này.`;
    } else if (count > 0) {
      level = "mid";
      icon = <WarningOutlined />;
      title = "Nhiều kết quả khớp";
      sub = `Tìm thấy ${count} tố cáo của ${distinctSubjects} người khác nhau. Đối chiếu đúng số CCCD trước khi kết luận.`;
    }

    return (
      <div className={`risk risk-${level}`}>
        <div className="risk-icon">{icon}</div>
        <div style={{ minWidth: 0 }}>
          <div className="risk-query">
            Tra cứu cho <span className="num">{queryKeyword}</span>
          </div>
          <h2 className="risk-title">{title}</h2>
          <p className="risk-sub">{sub}</p>
        </div>
      </div>
    );
  })();

  const searchPanel = (
    <div className="tab-panel">
      <header className="page-head">
        <h1>Tra cứu trước khi giao máy</h1>
        <p>
          Nhập CCCD, số điện thoại hoặc tên, hoặc quét ảnh CCCD để kiểm tra lịch
          sử tố cáo.
        </p>
      </header>

      <section className="scan-panel">
        <div className="scan-panel-head">
          <div className="scan-panel-icon">
            <ScanOutlined />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2>Quét ảnh CCCD</h2>
            <p className="hint" style={{ margin: "3px 0 0" }}>
              Đọc số CCCD và họ tên rồi tra cứu ngay. Ảnh được xử lý trên máy
              bạn, không gửi đi đâu.
            </p>
          </div>
        </div>

        <div className="scan-actions">
          <Button
            type="primary"
            size="large"
            icon={<UploadOutlined />}
            loading={isQuickScanning}
            onClick={() => uploadInputRef.current?.click()}
          >
            Tải ảnh
          </Button>
          <Button
            size="large"
            icon={<CameraOutlined />}
            disabled={isQuickScanning}
            onClick={() => cameraInputRef.current?.click()}
          >
            Chụp ảnh
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
        </div>

        {(isQuickScanning || quickScanResult || quickScanError) && (
          <div className="scan-output" role="status" aria-live="polite">
            {isQuickScanning && (
              <Flex align="center" gap={10}>
                <Spin size="small" />
                <span style={{ fontSize: 13 }}>Đang đọc ảnh và tra cứu</span>
              </Flex>
            )}
            {!isQuickScanning && quickScanError && (
              <span style={{ fontSize: 13, color: "var(--risk-mid)" }}>
                {quickScanError}
              </span>
            )}
            {!isQuickScanning && !quickScanError && quickScanResult && (
              <div
                className="field-grid"
                style={{ marginTop: 0, paddingTop: 0, border: 0 }}
              >
                <Field label="CCCD đọc được" value={quickScanResult.cccd} mono />
                <Field label="Họ tên đọc được" value={quickScanResult.fullName} />
              </div>
            )}
          </div>
        )}
      </section>

      <div className="divider-text">hoặc nhập thủ công</div>

      <Input.Search
        size="large"
        value={queryKeyword}
        onChange={(e) => setQueryKeyword(e.target.value)}
        onSearch={handleCheck}
        placeholder="CCCD, số điện thoại hoặc tên"
        enterButton={
          <Button type="primary" size="large" icon={<SearchOutlined />}>
            Kiểm tra
          </Button>
        }
        allowClear
      />

      {searchError && (
        <Alert
          type="warning"
          message={searchError}
          showIcon
          closable
          onClose={() => setSearchError("")}
          style={{ marginTop: 16 }}
        />
      )}

      {searchResult ? (
        <div id="search-results-section" style={{ marginTop: 22 }}>
          <div role="status" aria-live="polite">
            {riskView}
          </div>

          {searchResult.length > 0 && (
            <div className="card-grid" style={{ marginTop: 16 }}>
              {searchResult.map((item) => (
                <ReportCard
                  key={item.id}
                  item={item}
                  onViewDetail={setSelectedReport}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 22 }}>
          <EmptyState icon={<FileSearchOutlined />} title="Chưa tra cứu">
            Nhập thông tin hoặc quét ảnh CCCD để xem lịch sử tố cáo của người
            thuê.
          </EmptyState>
        </div>
      )}
    </div>
  );

  /* ── Tab: gửi tố cáo ─────────────────────── */

  const reportPanel = (
    <div className="tab-panel">
      <header className="page-head">
        <h1>Gửi tố cáo</h1>
        <p>
          Thông tin bạn gửi sẽ hiển thị công khai để những người cho thuê máy
          khác tra cứu được.
        </p>
      </header>

      <Form layout="vertical" onFinish={handleSubmitReport}>
        <div className="form-stack">
          <section className="scan-panel">
            <div className="scan-panel-head">
              <div className="scan-panel-icon">
                <ScanOutlined />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2>Quét CCCD để điền nhanh</h2>
                <p className="hint" style={{ margin: "3px 0 0" }}>
                  Tự trích xuất số CCCD và họ tên vào biểu mẫu bên dưới.
                </p>
              </div>
            </div>
            <Button
              icon={<ScanOutlined />}
              onClick={() => setIsScannerOpen(true)}
              style={{ marginTop: 4 }}
              block
            >
              Mở trình quét
            </Button>
          </section>

          <section className="surface" style={{ padding: 18 }}>
            <div className="surface-head">
              <h2 className="surface-title">
                <IdcardOutlined />
                Thông tin đối tượng
              </h2>
            </div>

            <Form.Item label="CCCD" required style={{ marginBottom: 16 }}>
              <Input
                prefix={<IdcardOutlined style={{ color: "var(--text-3)" }} />}
                size="large"
                value={reportForm.cccd}
                onChange={(e) =>
                  updateReportField("cccd", e.target.value.replace(/\D/g, ""))
                }
                maxLength={12}
                placeholder="12 chữ số"
                showCount
                className="num"
              />
            </Form.Item>

            <div className="form-row">
              <Form.Item label="Họ tên đối tượng" style={{ marginBottom: 0 }}>
                <Input
                  prefix={<UserOutlined style={{ color: "var(--text-3)" }} />}
                  value={reportForm.scammerName}
                  onChange={(e) =>
                    updateReportField("scammerName", e.target.value)
                  }
                  placeholder="Tên trên giấy tờ"
                />
              </Form.Item>
              <Form.Item label="Số điện thoại đối tượng" style={{ marginBottom: 0 }}>
                <Input
                  prefix={<PhoneOutlined style={{ color: "var(--text-3)" }} />}
                  value={reportForm.scammerPhone}
                  onChange={(e) =>
                    updateReportField("scammerPhone", e.target.value)
                  }
                  placeholder="Nếu có"
                />
              </Form.Item>
            </div>
          </section>

          <section className="surface" style={{ padding: 18 }}>
            <div className="surface-head">
              <h2 className="surface-title">
                <TeamOutlined />
                Thông tin của bạn
              </h2>
              <span className="hint">Không bắt buộc</span>
            </div>
            <div className="form-row">
              <Form.Item label="Họ tên" style={{ marginBottom: 0 }}>
                <Input
                  prefix={<UserOutlined style={{ color: "var(--text-3)" }} />}
                  value={reportForm.submitterName}
                  onChange={(e) =>
                    updateReportField("submitterName", e.target.value)
                  }
                  placeholder="Tên của bạn"
                />
              </Form.Item>
              <Form.Item label="Số điện thoại liên hệ" style={{ marginBottom: 0 }}>
                <Input
                  prefix={<PhoneOutlined style={{ color: "var(--text-3)" }} />}
                  value={reportForm.submitterPhone}
                  onChange={(e) =>
                    updateReportField("submitterPhone", e.target.value)
                  }
                  placeholder="Để người khác xác minh lại"
                />
              </Form.Item>
            </div>
          </section>

          <section className="surface" style={{ padding: 18 }}>
            <div className="surface-head">
              <h2 className="surface-title">
                <CameraOutlined />
                Thiết bị liên quan
              </h2>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={addEquipmentItem}
                disabled={equipmentItems.length >= MAX_EQUIPMENT_ITEMS}
              >
                Thêm máy
              </Button>
            </div>

            <div className="equip-list">
              {equipmentItems.map((item, index) => (
                <div className="equip-row" key={index}>
                  <Input
                    value={item.deviceName}
                    onChange={(e) =>
                      updateEquipmentItem(index, "deviceName", e.target.value)
                    }
                    placeholder="Tên máy, ví dụ Canon R6"
                    prefix={<CameraOutlined style={{ color: "var(--text-3)" }} />}
                  />
                  <Input
                    value={item.serialNumber}
                    onChange={(e) =>
                      updateEquipmentItem(index, "serialNumber", e.target.value)
                    }
                    placeholder="Số seri"
                    prefix={<NumberOutlined style={{ color: "var(--text-3)" }} />}
                    className="num"
                  />
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeEquipmentItem(index)}
                    disabled={equipmentItems.length === 1}
                    aria-label={`Xóa thiết bị ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="surface" style={{ padding: 18 }}>
            <div className="surface-head">
              <h2 className="surface-title">
                <ExclamationCircleOutlined />
                Nội dung và bằng chứng
              </h2>
            </div>

            <Form.Item label="Nội dung tố cáo" required>
              <Input.TextArea
                rows={5}
                value={reportForm.description}
                onChange={(e) =>
                  updateReportField("description", e.target.value)
                }
                placeholder="Mô tả cách thức lừa đảo, thời gian, thiết bị bị mất, link trao đổi."
                showCount
              />
            </Form.Item>

            <Form.Item label="Ảnh bằng chứng" style={{ marginBottom: 0 }}>
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
                <p className="ant-upload-text">
                  Kéo ảnh vào đây hoặc bấm để chọn
                </p>
                <p className="ant-upload-hint">
                  Tối đa {MAX_IMAGES} ảnh, mỗi ảnh {MAX_IMAGE_MB}MB
                </p>
              </Upload.Dragger>
            </Form.Item>
          </section>
        </div>

        {reportError && (
          <Alert
            type="error"
            message={reportError}
            showIcon
            closable
            onClose={() => setReportError("")}
            style={{ marginTop: 18 }}
          />
        )}
        {reportSuccess && (
          <Alert
            type="success"
            message={reportSuccess}
            showIcon
            closable
            onClose={() => setReportSuccess("")}
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
          style={{ marginTop: 18 }}
        >
          {isSubmitting ? "Đang gửi" : "Gửi tố cáo"}
        </Button>
      </Form>
    </div>
  );

  /* ── Render ──────────────────────────────── */

  const panels = {
    all: allReportsPanel,
    check: searchPanel,
    report: reportPanel,
    account: <AccountPanel />,
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Tới nội dung chính
      </a>
      <div className="app-backdrop" />
      <NoticeModal onVerify={() => setActiveTab("account")} />

      <div className="app-shell">
        {contextHolder}

        <header className="app-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              S
            </span>
            ScamChecker
          </div>

          <nav className="header-nav" aria-label="Chuyển mục">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className="header-nav-item"
                aria-current={activeTab === tab.key ? "page" : undefined}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          <span className="header-count">
            {isLoadingReports ? "Đang tải" : `${reports.length} tố cáo`}
          </span>
        </header>

        <main id="main" className="content">
          {panels[activeTab]}
        </main>
      </div>

      <ReportDetailModal
        report={selectedReport}
        open={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
      />

      <CccdScanner
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onApply={handleScannerApply}
      />

      <nav className="bottom-nav" aria-label="Chuyển mục">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="bottom-nav-item"
            aria-current={activeTab === tab.key ? "page" : undefined}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="bottom-nav-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </>
  );
}

export default App;
