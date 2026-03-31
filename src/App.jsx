import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  IdCard,
  Phone,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import "./App.css";
import {
  createReport,
  fetchReports,
  hasApiConfig,
  uploadEvidenceFile,
} from "./api";

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
const formatFileSize = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
const hasSubmitterInfo = (report) =>
  Boolean(report.submitterName?.trim() || report.submitterPhone?.trim());
const getRiskLevel = (count) => {
  if (count >= 3) return { label: "Rủi ro cao", className: "risk-high" };
  if (count >= 1) return { label: "Có cảnh báo", className: "risk-medium" };
  return { label: "An toàn tạm thời", className: "risk-low" };
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

function App() {
  const [activeTab, setActiveTab] = useState("check");
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
  const [previewImages, setPreviewImages] = useState([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [selectedReport, setSelectedReport] = useState(null);
  const [homePage, setHomePage] = useState(1);

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
          "Không đọc được dữ liệu từ API public. Kiểm tra lại endpoint và biến môi trường.",
        );
      } finally {
        setIsLoadingReports(false);
      }
    };

    init();
    return undefined;
  }, [loadReports]);

  const findMatches = useCallback(
    (keyword) => {
      const normalizedKeyword = normalizeSearchText(keyword);
      const keywordDigits = String(keyword ?? "").replace(/\D/g, "");

      if (!normalizedKeyword) return [];

      return reports.filter((item) => {
        const textFields = [
          item.cccd,
          item.scammerPhone,
          item.submitterPhone,
          item.scammerName,
          item.submitterName,
        ];

        const matchedByText = textFields.some((field) =>
          normalizeSearchText(field).includes(normalizedKeyword),
        );

        const matchedByDigits = keywordDigits
          ? [item.cccd, item.scammerPhone, item.submitterPhone].some((field) =>
              String(field ?? "").replace(/\D/g, "").includes(keywordDigits),
            )
          : false;

        return matchedByText || matchedByDigits;
      });
    },
    [reports],
  );

  useEffect(() => {
    if (searchResult === null || !queryKeyword.trim()) return;
    setSearchResult(findMatches(queryKeyword));
  }, [findMatches, queryKeyword, searchResult]);

  useEffect(() => {
    if (previewImages.length === 0 && !selectedReport) return;

    const handleEsc = (event) => {
      if (event.key === "Escape") {
        if (previewImages.length > 0) {
          setPreviewImages([]);
          setPreviewImageIndex(0);
          return;
        }
        setSelectedReport(null);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [previewImages, selectedReport]);

  const totalReports = reports.length;

  const totalHomePages = useMemo(
    () => Math.max(1, Math.ceil(reports.length / HOME_REPORTS_PER_PAGE)),
    [reports.length],
  );

  const paginatedReports = useMemo(() => {
    const startIndex = (homePage - 1) * HOME_REPORTS_PER_PAGE;
    return reports.slice(startIndex, startIndex + HOME_REPORTS_PER_PAGE);
  }, [homePage, reports]);

  const totalEvidenceInSearch = useMemo(
    () =>
      Array.isArray(searchResult)
        ? searchResult.reduce(
            (sum, item) =>
              sum +
              (item.imageUrls?.length ?? 0) +
              (item.equipmentItems?.length ?? 0),
            0,
          )
        : 0,
    [searchResult],
  );

  const latestFoundAt = useMemo(() => {
    if (!Array.isArray(searchResult) || searchResult.length === 0) return "";
    const newest = searchResult.reduce((currentNewest, item) =>
      item.createdAtMs > currentNewest.createdAtMs ? item : currentNewest,
    );
    return formatDate(newest.createdAt);
  }, [searchResult]);

  const previewImageUrl = previewImages[previewImageIndex] ?? "";

  const handleCheck = (event) => {
    event.preventDefault();
    setSearchError("");

    if (!queryKeyword.trim()) {
      setSearchResult(null);
      setSelectedReport(null);
      setSearchError("Vui lòng nhập CCCD, số điện thoại hoặc tên để tra cứu.");
      return;
    }

    const matchedReports = findMatches(queryKeyword);
    setSearchResult(matchedReports);
    setSelectedReport(null);
  };

  useEffect(() => {
    setHomePage((prevPage) => Math.min(prevPage, totalHomePages));
  }, [totalHomePages]);

  const openImagePreview = (images, index = 0) => {
    if (!Array.isArray(images) || images.length === 0) return;
    setPreviewImages(images);
    setPreviewImageIndex(index);
  };

  const closeImagePreview = () => {
    setPreviewImages([]);
    setPreviewImageIndex(0);
  };

  const goToPreviousPreviewImage = () => {
    setPreviewImageIndex((prevIndex) =>
      prevIndex === 0 ? previewImages.length - 1 : prevIndex - 1,
    );
  };

  const goToNextPreviewImage = () => {
    setPreviewImageIndex((prevIndex) =>
      prevIndex === previewImages.length - 1 ? 0 : prevIndex + 1,
    );
  };

  const updateReportField = (field, value) => {
    setReportForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (event) => {
    const files = Array.from(event.target.files ?? []);
    setReportError("");

    if (files.length > MAX_IMAGES) {
      setReportImages([]);
      setReportError(`Chỉ được upload tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }

    const invalidFile = files.find(
      (file) =>
        !file.type.startsWith("image/") ||
        file.size > MAX_IMAGE_MB * 1024 * 1024,
    );

    if (invalidFile) {
      setReportImages([]);
      setReportError(
        `File ${invalidFile.name} không hợp lệ. Chỉ nhận ảnh ≤ ${MAX_IMAGE_MB}MB.`,
      );
      return;
    }

    setReportImages(files);
  };

  const updateEquipmentItem = (index, field, value) => {
    setEquipmentItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const addEquipmentItem = () => {
    setReportError("");
    setEquipmentItems((prev) => {
      if (prev.length >= MAX_EQUIPMENT_ITEMS) {
        setReportError(`Chỉ được thêm tối đa ${MAX_EQUIPMENT_ITEMS} thiết bị.`);
        return prev;
      }
      return [...prev, createEmptyEquipmentItem()];
    });
  };

  const removeEquipmentItem = (index) => {
    setReportError("");
    setEquipmentItems((prev) => {
      if (prev.length === 1) return [createEmptyEquipmentItem()];
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const handleSubmitReport = async (event) => {
    event.preventDefault();
    setReportError("");
    setReportSuccess("");

    if (!hasApiConfig) {
      setReportError("API chưa cấu hình đầy đủ, chưa thể gửi tố cáo.");
      return;
    }

    if (!isValidCccd(reportForm.cccd)) {
      setReportError("CCCD không hợp lệ. Vui lòng nhập đúng 12 chữ số.");
      return;
    }

    if (!reportForm.description.trim()) {
      setReportError("Vui lòng nhập nội dung tố cáo.");
      return;
    }

    const trimmedEquipmentItems = equipmentItems
      .map((item) => ({
        deviceName: item.deviceName.trim(),
        serialNumber: item.serialNumber.trim(),
      }))
      .filter((item) => item.deviceName || item.serialNumber);

    const invalidEquipment = trimmedEquipmentItems.find(
      (item) => !item.deviceName || !item.serialNumber,
    );

    if (invalidEquipment) {
      setReportError("Mỗi thiết bị cần nhập đủ tên máy và số seri.");
      return;
    }

    try {
      setIsSubmitting(true);

      const imageUrls = await Promise.all(
        reportImages.map(async (file) => {
          return uploadEvidenceFile({ file, cccd: reportForm.cccd });
        }),
      );

      const newReport = {
        cccd: reportForm.cccd,
        reporter_name: reportForm.scammerName.trim() || "Không rõ",
        phone: reportForm.scammerPhone.trim(),
        submitter_name: reportForm.submitterName.trim(),
        submitter_phone: reportForm.submitterPhone.trim(),
        description: reportForm.description.trim(),
        image_urls: imageUrls,
        equipment_items: trimmedEquipmentItems,
        created_at: new Date().toISOString(),
        created_at_ms: Date.now(),
      };

      await createReport(newReport);

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
      setReportSuccess("Tố cáo đã được ghi nhận thành công.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi không xác định";
      setReportError(`Gửi tố cáo thất bại: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="app-shell">
      <div className="background-glow glow-1" />
      <div className="background-glow glow-2" />

      <div className="container">
        <section className="hero">
          <div className="hero-badge">Camera Rental Safety</div>
          <h1>Check scam CCCD khi thuê máy ảnh</h1>
          <p className="hero-subtitle">
            Đây là hệ thống phi lợi nhuận giúp các shop cho thuê máy ảnh kiểm
            tra rủi ro scam trước khi giao máy. Tra cứu nhanh lịch sử tố cáo để
            giảm thiểu thất thoát khi cho thuê máy ảnh
          </p>

          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-label">Tổng tố cáo</span>
              <strong>{totalReports}</strong>
            </div>
          </div>
        </section>

        {dataError ? (
          <div className="alert alert-error">{dataError}</div>
        ) : null}
        {isLoadingReports ? (
          <div className="alert alert-info">
            Đang tải dữ liệu từ API public...
          </div>
        ) : null}

        <section className="main-grid">
          <div className="content-card">
            <div className="tabs">
              <button
                className={activeTab === "check" ? "tab active" : "tab"}
                onClick={() => setActiveTab("check")}
              >
                Tra cứu CCCD/SĐT/Tên
              </button>
              <button
                className={activeTab === "report" ? "tab active" : "tab"}
                onClick={() => setActiveTab("report")}
              >
                Gửi tố cáo
              </button>
            </div>

            {activeTab === "check" ? (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <p className="section-kicker">
                      Kiểm tra trước khi giao máy
                    </p>
                    <h2>Tra cứu CCCD, SĐT hoặc tên</h2>
                  </div>
                </div>

                <form onSubmit={handleCheck} className="form">
                  <label htmlFor="queryKeyword">
                    Nhập CCCD, số điện thoại hoặc tên
                  </label>
                  <div className="input-row">
                    <div className="search-input-wrap">
                      <Search size={18} className="search-input-icon" />
                      <input
                        id="queryKeyword"
                        type="text"
                        value={queryKeyword}
                        onChange={(event) => setQueryKeyword(event.target.value)}
                        placeholder="Ví dụ: 012345678901 / 0988xxxxxx / Nguyen Van A"
                      />
                    </div>
                    <button type="submit" className="primary-btn">
                      Kiểm tra
                    </button>
                  </div>
                </form>

                {searchError ? (
                  <div className="alert alert-error">{searchError}</div>
                ) : null}

                {searchResult ? (
                  <div className="result-card">
                    <div className="result-summary">
                      <div>
                        <p className="result-label">Kết quả tra cứu</p>
                        <h3>{queryKeyword}</h3>
                      </div>
                      <div
                        className={`result-badge ${getRiskLevel(searchResult.length).className}`}
                      >
                        {getRiskLevel(searchResult.length).label}
                      </div>
                    </div>

                    <div className="search-metrics-grid">
                      <div className="search-metric-card">
                        <ShieldAlert size={18} />
                        <div>
                          <p>Tổng tố cáo khớp</p>
                          <strong>{searchResult.length}</strong>
                        </div>
                      </div>
                      <div className="search-metric-card">
                        <Camera size={18} />
                        <div>
                          <p>Bằng chứng liên quan</p>
                          <strong>{totalEvidenceInSearch}</strong>
                        </div>
                      </div>
                      <div className="search-metric-card">
                        <CalendarClock size={18} />
                        <div>
                          <p>Tố cáo mới nhất</p>
                          <strong>{latestFoundAt || "Chưa có"}</strong>
                        </div>
                      </div>
                    </div>

                    {searchResult.length > 0 ? (
                      <ul className="result-list">
                        {searchResult.map((item) => (
                          <li key={item.id} className="report-card">
                            <div className="report-top">
                              <div>
                                <strong>{item.scammerName}</strong>
                                <p className="report-date">
                                  {formatDate(item.createdAt)}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="secondary-btn report-detail-btn"
                                onClick={() => setSelectedReport(item)}
                              >
                                Xem đầy đủ
                              </button>
                            </div>

                            <div className="report-meta-grid">
                              <div className="report-meta-item">
                                <p className="report-meta-label">CCCD</p>
                                <p className="report-meta-value">{item.cccd}</p>
                              </div>
                              <div className="report-meta-item">
                                <p className="report-meta-label">
                                  Số đối tượng lừa đảo
                                </p>
                                <p className="report-meta-value">
                                  {item.scammerPhone?.trim() || "Không cung cấp"}
                                </p>
                              </div>
                              {hasSubmitterInfo(item) ? (
                                <>
                                  <div className="report-meta-item">
                                    <p className="report-meta-label">
                                      Tên người đăng
                                    </p>
                                    <p className="report-meta-value">
                                      {item.submitterName?.trim() ||
                                        "Không cung cấp"}
                                    </p>
                                  </div>
                                  <div className="report-meta-item">
                                    <p className="report-meta-label">
                                      SĐT người đăng
                                    </p>
                                    <p className="report-meta-value">
                                      {item.submitterPhone?.trim() ||
                                        "Không cung cấp"}
                                    </p>
                                  </div>
                                </>
                              ) : null}
                            </div>

                            <p className="report-description">
                              {item.description}
                            </p>

                            {item.equipmentItems?.length > 0 ? (
                              <div className="equipment-display">
                                <p className="equipment-title">
                                  Thiết bị liên quan
                                </p>
                                <ul className="equipment-display-list">
                                  {item.equipmentItems.map(
                                    (equipment, index) => (
                                      <li
                                        key={`${item.id}-equipment-${index}`}
                                        className="equipment-pill"
                                      >
                                        {equipment.deviceName} - S/N:{" "}
                                        {equipment.serialNumber}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </div>
                            ) : null}

                            {item.imageUrls?.length > 0 ? (
                              <div className="images-grid">
                                {item.imageUrls.map((url, imageIndex) => (
                                  <button
                                    key={url}
                                    type="button"
                                    className="thumb-button"
                                    onClick={() =>
                                      openImagePreview(item.imageUrls, imageIndex)
                                    }
                                  >
                                    <img
                                      src={url}
                                      alt="Bằng chứng scam"
                                      className="thumb"
                                    />
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="empty-state success-state">
                        Chưa có tố cáo nào cho CCCD này trong hệ thống.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-state">
                    Nhập CCCD/SĐT/tên để kiểm tra lịch sử tố cáo trước khi xác
                    nhận giao dịch.
                  </div>
                )}
              </section>
            ) : (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <p className="section-kicker">Báo cáo cộng đồng</p>
                    <h2>Gửi tố cáo mới</h2>
                  </div>
                </div>

                <form onSubmit={handleSubmitReport} className="form">
                  <label htmlFor="reportCccd">CCCD đối tượng bị tố cáo</label>
                  <input
                    id="reportCccd"
                    type="text"
                    value={reportForm.cccd}
                    onChange={(event) =>
                      updateReportField(
                        "cccd",
                        event.target.value.replace(/\D/g, ""),
                      )
                    }
                    maxLength={12}
                    placeholder="Nhập đúng 12 chữ số CCCD"
                    required
                  />

                  <div className="form-grid">
                    <div>
                      <label htmlFor="scammerName">Tên đối tượng lừa đảo</label>
                      <input
                        id="scammerName"
                        type="text"
                        value={reportForm.scammerName}
                        onChange={(event) =>
                          updateReportField("scammerName", event.target.value)
                        }
                        placeholder="VD: Nguyễn Văn A"
                      />
                    </div>

                    <div>
                      <label htmlFor="scammerPhone">Số đối tượng lừa đảo</label>
                      <input
                        id="scammerPhone"
                        type="text"
                        value={reportForm.scammerPhone}
                        onChange={(event) =>
                          updateReportField("scammerPhone", event.target.value)
                        }
                        placeholder="SĐT đối tượng (nếu có)"
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div>
                      <label htmlFor="submitterName">Tên người đăng</label>
                      <input
                        id="submitterName"
                        type="text"
                        value={reportForm.submitterName}
                        onChange={(event) =>
                          updateReportField("submitterName", event.target.value)
                        }
                        placeholder="Tên của bạn (không bắt buộc)"
                      />
                    </div>

                    <div>
                      <label htmlFor="submitterPhone">SĐT người đăng</label>
                      <input
                        id="submitterPhone"
                        type="text"
                        value={reportForm.submitterPhone}
                        onChange={(event) =>
                          updateReportField("submitterPhone", event.target.value)
                        }
                        placeholder="Không bắt buộc"
                      />
                    </div>
                  </div>

                  <div className="equipment-section">
                    <div className="equipment-header">
                      <label>Thiết bị liên quan (nhiều máy)</label>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={addEquipmentItem}
                      >
                        + Thêm máy
                      </button>
                    </div>
                    <div className="equipment-list">
                      {equipmentItems.map((item, index) => (
                        <div
                          key={`equipment-${index}`}
                          className="equipment-item-row"
                        >
                          <input
                            type="text"
                            value={item.deviceName}
                            onChange={(event) =>
                              updateEquipmentItem(
                                index,
                                "deviceName",
                                event.target.value,
                              )
                            }
                            placeholder="Tên máy (VD: Canon R6, Sony A7IV...)"
                          />
                          <input
                            type="text"
                            value={item.serialNumber}
                            onChange={(event) =>
                              updateEquipmentItem(
                                index,
                                "serialNumber",
                                event.target.value,
                              )
                            }
                            placeholder="Số seri máy"
                          />
                          <button
                            type="button"
                            className="danger-btn"
                            onClick={() => removeEquipmentItem(index)}
                            disabled={equipmentItems.length === 1}
                          >
                            Xóa
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <label htmlFor="reportContent">Nội dung tố cáo</label>
                  <textarea
                    id="reportContent"
                    rows={5}
                    value={reportForm.description}
                    onChange={(event) =>
                      updateReportField("description", event.target.value)
                    }
                    placeholder="Mô tả cách thức lừa đảo, thời gian, thiết bị liên quan, link chat, bằng chứng..."
                    required
                  />

                  <label htmlFor="reportImages">Ảnh bằng chứng</label>
                  <input
                    id="reportImages"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                  />
                  <p className="hint">
                    Tối đa {MAX_IMAGES} ảnh, mỗi ảnh không vượt quá{" "}
                    {MAX_IMAGE_MB}MB.
                  </p>

                  {reportImages.length > 0 ? (
                    <div className="image-preview-grid">
                      {reportImages.map((file) => (
                        <div
                          key={file.name + file.lastModified}
                          className="image-preview-item"
                        >
                          <div className="image-icon">🖼️</div>
                          <div>
                            <p className="image-name">{file.name}</p>
                            <p className="image-size">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    className="primary-btn full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Đang gửi tố cáo..." : "Gửi tố cáo"}
                  </button>
                </form>

                {reportError ? (
                  <div className="alert alert-error">{reportError}</div>
                ) : null}
                {reportSuccess ? (
                  <div className="alert alert-success">{reportSuccess}</div>
                ) : null}
              </section>
            )}
          </div>

          <aside className="sidebar-card">
            <div className="sidebar-section">
              <p className="section-kicker">Toàn bộ dữ liệu</p>
              <h2>Tất cả vụ scam</h2>
            </div>

            {reports.length === 0 ? (
              <div className="empty-state">Chưa có dữ liệu.</div>
            ) : (
              <>
                <ul className="latest-list">
                  {paginatedReports.map((item) => (
                  <li key={item.id} className="mini-report-card">
                    <div className="report-top">
                      <div>
                        <strong>{item.scammerName}</strong>
                        <p className="report-date">{formatDate(item.createdAt)}</p>
                      </div>
                    </div>

                    <div className="report-meta-grid">
                      <div className="report-meta-item">
                        <p className="report-meta-label">CCCD</p>
                        <p className="report-meta-value">{item.cccd}</p>
                      </div>
                      <div className="report-meta-item">
                        <p className="report-meta-label">
                          Số đối tượng lừa đảo
                        </p>
                        <p className="report-meta-value">
                          {item.scammerPhone?.trim() || "Không cung cấp"}
                        </p>
                      </div>
                      {hasSubmitterInfo(item) ? (
                        <>
                          <div className="report-meta-item">
                            <p className="report-meta-label">Tên người đăng</p>
                            <p className="report-meta-value">
                              {item.submitterName?.trim() || "Không cung cấp"}
                            </p>
                          </div>
                          <div className="report-meta-item">
                            <p className="report-meta-label">SĐT người đăng</p>
                            <p className="report-meta-value">
                              {item.submitterPhone?.trim() || "Không cung cấp"}
                            </p>
                          </div>
                        </>
                      ) : null}
                    </div>

                    <p className="mini-description">{item.description}</p>

                    {item.equipmentItems?.length > 0 ? (
                      <div className="equipment-display">
                        <p className="equipment-title">Thiết bị liên quan</p>
                        <ul className="equipment-display-list">
                          {item.equipmentItems.map((equipment, index) => (
                            <li
                              key={`${item.id}-latest-equipment-${index}`}
                              className="equipment-pill"
                            >
                              {equipment.deviceName} - S/N:{" "}
                              {equipment.serialNumber}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {item.imageUrls?.length > 0 ? (
                      <div className="images-grid compact">
                        {item.imageUrls.map((url, imageIndex) => (
                          <button
                            key={url}
                            type="button"
                            className="thumb-button"
                            onClick={() =>
                              openImagePreview(item.imageUrls, imageIndex)
                            }
                          >
                            <img
                              src={url}
                              alt="Bằng chứng scam"
                              className="thumb"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </li>
                  ))}
                </ul>

                <div className="pagination-wrap">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setHomePage((prev) => Math.max(prev - 1, 1))}
                    disabled={homePage === 1}
                  >
                    Trước
                  </button>
                  <p className="pagination-text">
                    Trang {homePage}/{totalHomePages}
                  </p>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() =>
                      setHomePage((prev) => Math.min(prev + 1, totalHomePages))
                    }
                    disabled={homePage === totalHomePages}
                  >
                    Sau
                  </button>
                </div>
              </>
            )}
          </aside>
        </section>
      </div>

      {previewImageUrl ? (
        <div
          className="image-modal-overlay"
          role="presentation"
          onClick={closeImagePreview}
        >
          <div
            className="image-modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="Xem ảnh bằng chứng"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="image-modal-close"
              onClick={closeImagePreview}
            >
              Đóng
            </button>
            {previewImages.length > 1 ? (
              <>
                <button
                  type="button"
                  className="image-modal-nav image-modal-nav-left"
                  onClick={goToPreviousPreviewImage}
                  aria-label="Ảnh trước"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="image-modal-nav image-modal-nav-right"
                  onClick={goToNextPreviewImage}
                  aria-label="Ảnh sau"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            ) : null}
            <img
              src={previewImageUrl}
              alt="Ảnh bằng chứng phóng to"
              className="image-modal-preview"
            />
            <p className="image-modal-counter">
              Ảnh {previewImageIndex + 1}/{previewImages.length}
            </p>
          </div>
        </div>
      ) : null}

      {selectedReport ? (
        <div
          className="report-modal-overlay"
          role="presentation"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="report-modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết tố cáo"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="report-modal-header">
              <div>
                <p className="section-kicker">Chi tiết đầy đủ</p>
                <h3>{selectedReport.scammerName || "Không rõ đối tượng"}</h3>
                <p className="report-date">{formatDate(selectedReport.createdAt)}</p>
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setSelectedReport(null)}
              >
                Đóng
              </button>
            </div>

            <div className="report-modal-meta-grid">
              <div className="report-modal-meta-item">
                <IdCard size={16} />
                <div>
                  <p>CCCD</p>
                  <strong>{selectedReport.cccd || "Không cung cấp"}</strong>
                </div>
              </div>
              <div className="report-modal-meta-item">
                <Phone size={16} />
                <div>
                  <p>SĐT đối tượng</p>
                  <strong>
                    {selectedReport.scammerPhone?.trim() || "Không cung cấp"}
                  </strong>
                </div>
              </div>
              {hasSubmitterInfo(selectedReport) ? (
                <>
                  <div className="report-modal-meta-item">
                    <UserRound size={16} />
                    <div>
                      <p>Người đăng</p>
                      <strong>
                        {selectedReport.submitterName?.trim() || "Không cung cấp"}
                      </strong>
                    </div>
                  </div>
                  <div className="report-modal-meta-item">
                    <Phone size={16} />
                    <div>
                      <p>SĐT người đăng</p>
                      <strong>
                        {selectedReport.submitterPhone?.trim() ||
                          "Không cung cấp"}
                      </strong>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="report-modal-section">
              <p className="report-modal-title">Nội dung tố cáo</p>
              <p className="report-description">
                {selectedReport.description || "Không có nội dung"}
              </p>
            </div>

            {selectedReport.equipmentItems?.length > 0 ? (
              <div className="report-modal-section">
                <p className="report-modal-title">Thiết bị liên quan</p>
                <ul className="equipment-display-list">
                  {selectedReport.equipmentItems.map((equipment, index) => (
                    <li
                      key={`${selectedReport.id}-modal-equipment-${index}`}
                      className="equipment-pill"
                    >
                      {equipment.deviceName} - S/N: {equipment.serialNumber}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="report-modal-section">
              <p className="report-modal-title">Ảnh bằng chứng</p>
              {selectedReport.imageUrls?.length > 0 ? (
                <div className="images-grid">
                  {selectedReport.imageUrls.map((url, imageIndex) => (
                    <button
                      key={url}
                      type="button"
                      className="thumb-button"
                      onClick={() =>
                        openImagePreview(selectedReport.imageUrls, imageIndex)
                      }
                    >
                      <img src={url} alt="Bằng chứng scam" className="thumb" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="report-modal-empty">
                  <CircleAlert size={16} />
                  Chưa có ảnh bằng chứng.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
