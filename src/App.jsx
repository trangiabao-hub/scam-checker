import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  hasSupabaseConfig,
  supabase,
  SUPABASE_BUCKET,
  SUPABASE_REPORTS_TABLE,
} from "./supabase";

const MAX_IMAGES = 6;
const MAX_IMAGE_MB = 5;
const MAX_EQUIPMENT_ITEMS = 10;
const createEmptyEquipmentItem = () => ({ deviceName: "", serialNumber: "" });

const isValidCccd = (value) => /^\d{12}$/.test(value);
const formatDate = (value) => new Date(value).toLocaleString("vi-VN");
const formatFileSize = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

const normalizeReport = (row) => ({
  id: row.id,
  cccd: row.cccd,
  scammerName: row.reporter_name,
  scammerPhone: row.phone,
  submitterName: row.submitter_name ?? "",
  submitterPhone: row.submitter_phone ?? "",
  description: row.description,
  imageUrls: row.image_urls ?? [],
  equipmentItems: Array.isArray(row.equipment_items)
    ? row.equipment_items
        .map((item) => ({
          deviceName: String(item?.deviceName ?? "").trim(),
          serialNumber: String(item?.serialNumber ?? "").trim(),
        }))
        .filter((item) => item.deviceName && item.serialNumber)
    : [],
  createdAt: row.created_at,
  createdAtMs: row.created_at_ms,
});

function App() {
  const [activeTab, setActiveTab] = useState("check");
  const [reports, setReports] = useState([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [supabaseError, setSupabaseError] = useState("");

  const [queryCccd, setQueryCccd] = useState("");
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
  const [previewImageUrl, setPreviewImageUrl] = useState("");

  const loadReports = useCallback(async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from(SUPABASE_REPORTS_TABLE)
      .select("*")
      .order("created_at_ms", { ascending: false });

    if (error) throw error;

    setReports((data ?? []).map(normalizeReport));
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setSupabaseError(
        "Chưa cấu hình Supabase. Hãy tạo file .env từ .env.example để kết nối Database và Storage.",
      );
      setIsLoadingReports(false);
      return;
    }

    const init = async () => {
      try {
        await loadReports();
        setSupabaseError("");
      } catch {
        setSupabaseError(
          "Không đọc được dữ liệu Supabase. Kiểm tra lại schema, RLS và biến môi trường.",
        );
      } finally {
        setIsLoadingReports(false);
      }
    };

    init();
    const realtimeChannel = supabase
      .channel("scam-cccd-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: SUPABASE_REPORTS_TABLE,
        },
        async () => {
          try {
            await loadReports();
          } catch {
            setSupabaseError(
              "Không đồng bộ được dữ liệu realtime. Vui lòng tải lại trang.",
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [loadReports]);

  useEffect(() => {
    if (searchResult === null || !isValidCccd(queryCccd)) return;
    setSearchResult(reports.filter((item) => item.cccd === queryCccd));
  }, [reports, queryCccd, searchResult]);

  useEffect(() => {
    if (!previewImageUrl) return;

    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setPreviewImageUrl("");
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [previewImageUrl]);

  const totalReports = reports.length;

  const latestReports = useMemo(
    () =>
      [...reports]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5),
    [reports],
  );

  const handleCheck = (event) => {
    event.preventDefault();
    setSearchError("");

    if (!isValidCccd(queryCccd)) {
      setSearchResult(null);
      setSearchError("CCCD phải gồm đúng 12 chữ số.");
      return;
    }

    const matches = reports.filter((item) => item.cccd === queryCccd);
    setSearchResult(matches);
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

    if (!hasSupabaseConfig || !supabase) {
      setReportError("Supabase chưa cấu hình đầy đủ, chưa thể gửi tố cáo.");
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
          const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
          const filePath = `reports/${reportForm.cccd}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from(SUPABASE_BUCKET)
            .upload(filePath, file, { upsert: false, contentType: file.type });

          if (uploadError) throw uploadError;

          const { data } = supabase.storage
            .from(SUPABASE_BUCKET)
            .getPublicUrl(filePath);
          return data.publicUrl;
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

      const { error: insertError } = await supabase
        .from(SUPABASE_REPORTS_TABLE)
        .insert(newReport);

      if (insertError) {
        const isMissingColumnError =
          /equipment_items|submitter_name|submitter_phone/i.test(
          insertError.message ?? "",
        );

        if (!isMissingColumnError) throw insertError;

        const fallbackEquipmentDetails =
          trimmedEquipmentItems.length > 0
            ? `\n\nThiết bị liên quan:\n${trimmedEquipmentItems
                .map(
                  (item, index) =>
                    `${index + 1}. ${item.deviceName} - S/N: ${item.serialNumber}`,
                )
                .join("\n")}`
            : "";

        const fallbackSubmitterDetails =
          reportForm.submitterName.trim() || reportForm.submitterPhone.trim()
            ? `\n\nThông tin người đăng:\n- Tên: ${reportForm.submitterName.trim() || "Không cung cấp"}\n- SĐT: ${reportForm.submitterPhone.trim() || "Không cung cấp"}`
            : "";

        const { error: retryInsertError } = await supabase
          .from(SUPABASE_REPORTS_TABLE)
          .insert({
            cccd: newReport.cccd,
            reporter_name: newReport.reporter_name,
            phone: newReport.phone,
            description: `${newReport.description}${fallbackEquipmentDetails}${fallbackSubmitterDetails}`,
            image_urls: newReport.image_urls,
            created_at: newReport.created_at,
            created_at_ms: newReport.created_at_ms,
          });

        if (retryInsertError) throw retryInsertError;
      }

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

        {supabaseError ? (
          <div className="alert alert-error">{supabaseError}</div>
        ) : null}
        {isLoadingReports ? (
          <div className="alert alert-info">
            Đang tải dữ liệu từ Supabase...
          </div>
        ) : null}

        <section className="main-grid">
          <div className="content-card">
            <div className="tabs">
              <button
                className={activeTab === "check" ? "tab active" : "tab"}
                onClick={() => setActiveTab("check")}
              >
                Tra cứu CCCD
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
                    <h2>Tra cứu CCCD</h2>
                  </div>
                </div>

                <form onSubmit={handleCheck} className="form">
                  <label htmlFor="queryCccd">Nhập số CCCD (12 số)</label>
                  <div className="input-row">
                    <input
                      id="queryCccd"
                      type="text"
                      value={queryCccd}
                      onChange={(event) =>
                        setQueryCccd(event.target.value.replace(/\D/g, ""))
                      }
                      maxLength={12}
                      placeholder="Ví dụ: 012345678901"
                    />
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
                        <h3>{queryCccd}</h3>
                      </div>
                      <div className="result-badge">
                        {searchResult.length} tố cáo
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
                              <div className="report-meta-item">
                                <p className="report-meta-label">
                                  Tên người đăng
                                </p>
                                <p className="report-meta-value">
                                  {item.submitterName?.trim() || "Không cung cấp"}
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
                              <div className="report-meta-item">
                                <p className="report-meta-label">Số ảnh</p>
                                <p className="report-meta-value">
                                  {item.imageUrls?.length ?? 0}
                                </p>
                              </div>
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
                                {item.imageUrls.map((url) => (
                                  <button
                                    key={url}
                                    type="button"
                                    className="thumb-button"
                                    onClick={() => setPreviewImageUrl(url)}
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
                    Nhập CCCD để kiểm tra lịch sử tố cáo trước khi xác nhận giao
                    dịch.
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
              <p className="section-kicker">Mới nhất</p>
              <h2>5 tố cáo gần đây</h2>
            </div>

            {latestReports.length === 0 ? (
              <div className="empty-state">Chưa có dữ liệu.</div>
            ) : (
              <ul className="latest-list">
                {latestReports.map((item) => (
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
                      <div className="report-meta-item">
                        <p className="report-meta-label">Số ảnh</p>
                        <p className="report-meta-value">
                          {item.imageUrls?.length ?? 0}
                        </p>
                      </div>
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
                        {item.imageUrls.map((url) => (
                          <button
                            key={url}
                            type="button"
                            className="thumb-button"
                            onClick={() => setPreviewImageUrl(url)}
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
            )}
          </aside>
        </section>
      </div>

      {previewImageUrl ? (
        <div
          className="image-modal-overlay"
          role="presentation"
          onClick={() => setPreviewImageUrl("")}
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
              onClick={() => setPreviewImageUrl("")}
            >
              Đóng
            </button>
            <img
              src={previewImageUrl}
              alt="Ảnh bằng chứng phóng to"
              className="image-modal-preview"
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
