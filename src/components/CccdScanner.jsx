import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Button,
  Segmented,
  Upload,
  Space,
  Typography,
  Alert,
  Spin,
  Input,
  Tag,
  Flex,
  Progress,
  message,
} from "antd";
import {
  CameraOutlined,
  UploadOutlined,
  RedoOutlined,
  CheckCircleOutlined,
  ScanOutlined,
  CloseCircleOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { scanCccdImage } from "../ocr";

const { Text, Title, Paragraph } = Typography;

const MODE_UPLOAD = "upload";
const MODE_CAMERA = "camera";

const FIELD_LABELS = [
  { key: "cccd", label: "Số CCCD/CMND", highlight: true },
  { key: "fullName", label: "Họ và tên", highlight: true },
  { key: "dateOfBirth", label: "Ngày sinh" },
  { key: "gender", label: "Giới tính" },
  { key: "nationality", label: "Quốc tịch" },
  { key: "placeOfOrigin", label: "Quê quán" },
  { key: "placeOfResidence", label: "Nơi thường trú" },
  { key: "dateOfExpiry", label: "Có giá trị đến" },
];

const EMPTY_RESULT = {
  cccd: "",
  fullName: "",
  dateOfBirth: "",
  gender: "",
  nationality: "",
  placeOfOrigin: "",
  placeOfResidence: "",
  dateOfExpiry: "",
};

export default function CccdScanner({
  open,
  onClose,
  onApply,
  autoApply = false,
  autoApplyDelayMs = 600,
}) {
  const [mode, setMode] = useState(MODE_UPLOAD);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileBlob, setFileBlob] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [editedResult, setEditedResult] = useState(EMPTY_RESULT);
  const [errorMsg, setErrorMsg] = useState("");
  const [isCameraReady, setIsCameraReady] = useState(false);

  const hasEdits = useMemo(() => {
    if (!result) return false;
    return Object.keys(EMPTY_RESULT).some((k) => (editedResult[k] ?? "") !== (result[k] ?? ""));
  }, [editedResult, result]);

  const updateField = (key, value) =>
    setEditedResult((prev) => ({ ...prev, [key]: value }));
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const progressTimerRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraReady(false);
  }, []);

  const resetState = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return "";
    });
    setFileBlob(null);
    setResult(null);
    setEditedResult(EMPTY_RESULT);
    setErrorMsg("");
    setProgress(0);
    setIsScanning(false);
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraReady(true);
    } catch (err) {
      setErrorMsg(
        err?.name === "NotAllowedError"
          ? "Bạn chưa cấp quyền camera cho trình duyệt."
          : "Không mở được camera. Hãy kiểm tra thiết bị hoặc thử upload ảnh.",
      );
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      resetState();
      return undefined;
    }
    if (mode === MODE_CAMERA) {
      startCamera();
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [open, mode, startCamera, stopCamera, resetState]);

  useEffect(
    () => () => {
      stopCamera();
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const captureFromCamera = () => {
    if (!videoRef.current || !isCameraReady) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErrorMsg("Không chụp được ảnh từ camera.");
          return;
        }
        const url = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return url;
        });
        setFileBlob(blob);
        setResult(null);
        setErrorMsg("");
      },
      "image/jpeg",
      0.92,
    );
  };

  const handleFile = (file) => {
    if (!file.type?.startsWith("image/")) {
      message.error("Vui lòng chọn file ảnh (JPG/PNG).");
      return Upload.LIST_IGNORE;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error("Ảnh quá lớn (>10MB).");
      return Upload.LIST_IGNORE;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
    setFileBlob(file);
    setResult(null);
    setErrorMsg("");
    return Upload.LIST_IGNORE;
  };

  const startProgressFake = () => {
    setProgress(2);
    progressTimerRef.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(1, Math.round((92 - p) / 12)) : p));
    }, 250);
  };
  const stopProgressFake = (done = true) => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(done ? 100 : 0);
  };

  const runScan = async () => {
    if (!fileBlob) {
      setErrorMsg("Hãy upload ảnh hoặc chụp ảnh CCCD trước khi quét.");
      return;
    }
    setIsScanning(true);
    setErrorMsg("");
    setResult(null);
    startProgressFake();
    try {
      const data = await scanCccdImage(fileBlob);
      stopProgressFake(true);
      setResult(data);
      const normalized = {
        cccd: data.cccd ?? "",
        fullName: data.fullName ?? "",
        dateOfBirth: data.dateOfBirth ?? "",
        gender: data.gender ?? "",
        nationality: data.nationality ?? "",
        placeOfOrigin: data.placeOfOrigin ?? "",
        placeOfResidence: data.placeOfResidence ?? "",
        dateOfExpiry: data.dateOfExpiry ?? "",
      };
      setEditedResult(normalized);
      if (!data.cccd && !data.fullName) {
        setErrorMsg(
          "Không trích xuất được CCCD hoặc tên. Vui lòng chụp rõ nét, đủ ánh sáng và toàn bộ thẻ — bạn có thể tự nhập tay bên dưới.",
        );
        return;
      }
      // Auto-apply mode: dùng cho tab Tra cứu — quét xong là search luôn,
      // không cần user bấm "Điền vào biểu mẫu".
      if (autoApply) {
        setTimeout(() => {
          onApply?.(normalized);
          onClose?.();
        }, autoApplyDelayMs);
      }
    } catch (err) {
      stopProgressFake(false);
      setErrorMsg(
        err instanceof Error
          ? `Lỗi OCR: ${err.message}`
          : "Lỗi không xác định khi nhận dạng.",
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApply?.(editedResult);
    onClose?.();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          <ScanOutlined style={{ color: "#4f46e5" }} />
          <span>Quét CCCD/VNeID bằng AI</span>
        </Space>
      }
      footer={null}
      width={780}
      centered
      destroyOnClose
    >
      <Paragraph type="secondary" style={{ marginTop: 4 }}>
        Đưa mặt trước hoặc mặt sau CCCD/CMND vào khung. AI sẽ tự động trích xuất
        <Text strong> số CCCD </Text>và<Text strong> họ tên</Text>.
        {autoApply && (
          <Text strong style={{ color: "#4f46e5" }}>
            {" "}
            Quét xong sẽ tự tra cứu ngay.
          </Text>
        )}{" "}
        Toàn bộ xử lý chạy trên trình duyệt, không gửi ảnh đi đâu cả.
      </Paragraph>

      <Segmented
        block
        value={mode}
        onChange={(value) => {
          resetState();
          setMode(value);
        }}
        options={[
          {
            label: (
              <Space size={6}>
                <UploadOutlined /> Tải ảnh lên
              </Space>
            ),
            value: MODE_UPLOAD,
          },
          {
            label: (
              <Space size={6}>
                <CameraOutlined /> Mở camera
              </Space>
            ),
            value: MODE_CAMERA,
          },
        ]}
        style={{ marginBottom: 16 }}
      />

      {mode === MODE_UPLOAD && (
        <Upload.Dragger
          accept="image/*"
          multiple={false}
          showUploadList={false}
          beforeUpload={handleFile}
          style={{ padding: 12, marginBottom: 16 }}
        >
          <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}>
            <UploadOutlined style={{ fontSize: 32, color: "#4f46e5" }} />
          </p>
          <p className="ant-upload-text" style={{ fontWeight: 600 }}>
            Kéo thả hoặc bấm để chọn ảnh CCCD
          </p>
          <p className="ant-upload-hint">JPG/PNG, ≤ 10MB. Nên chụp ngang, rõ nét.</p>
        </Upload.Dragger>
      )}

      {mode === MODE_CAMERA && (
        <div
          style={{
            position: "relative",
            background: "#000",
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 16,
            aspectRatio: "16 / 10",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: "82%",
                height: "62%",
                border: "2px dashed rgba(255,255,255,0.85)",
                borderRadius: 12,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
              }}
            />
          </div>
          <Flex
            justify="center"
            gap={8}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 12,
              pointerEvents: "auto",
            }}
          >
            <Button
              type="primary"
              size="large"
              icon={<CameraOutlined />}
              onClick={captureFromCamera}
              disabled={!isCameraReady}
            >
              Chụp ảnh
            </Button>
          </Flex>
        </div>
      )}

      {previewUrl && (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            background: "#fafafe",
          }}
        >
          <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
            <Text strong>Ảnh sẽ quét</Text>
            <Space>
              <Button
                size="small"
                icon={<RedoOutlined />}
                onClick={() => {
                  resetState();
                  if (mode === MODE_CAMERA) startCamera();
                }}
              >
                Chọn lại
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<ScanOutlined />}
                loading={isScanning}
                onClick={runScan}
              >
                Quét bằng AI
              </Button>
            </Space>
          </Flex>
          <img
            src={previewUrl}
            alt="CCCD preview"
            style={{
              width: "100%",
              maxHeight: 360,
              objectFit: "contain",
              borderRadius: 8,
              background: "#fff",
            }}
          />
        </div>
      )}

      {(isScanning || progress > 0) && (
        <div style={{ marginBottom: 12 }}>
          <Progress
            percent={progress}
            status={isScanning ? "active" : progress === 100 ? "success" : "normal"}
            strokeColor={{ from: "#4f46e5", to: "#06b6d4" }}
          />
          {isScanning && (
            <Text type="secondary">
              <Spin size="small" style={{ marginRight: 8 }} />
              AI đang đọc ảnh, lần quét đầu tiên cần tải model (~10-20s)...
            </Text>
          )}
        </div>
      )}

      {errorMsg && (
        <Alert
          type="warning"
          showIcon
          icon={<CloseCircleOutlined />}
          message={errorMsg}
          style={{ marginBottom: 12 }}
        />
      )}

      {result && (
        <div>
          <Flex
            justify="space-between"
            align="center"
            wrap
            gap={8}
            style={{ marginTop: 0, marginBottom: 8 }}
          >
            <Title level={5} style={{ margin: 0 }}>
              <CheckCircleOutlined style={{ color: "#10b981", marginRight: 6 }} />
              Kết quả nhận dạng
            </Title>
            <Space size={6}>
              {!autoApply && (
                <Tag icon={<EditOutlined />} color="processing">
                  Có thể chỉnh sửa
                </Tag>
              )}
              {!autoApply && hasEdits && <Tag color="orange">Đã sửa so với AI</Tag>}
              {autoApply && (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  Đang tra cứu...
                </Tag>
              )}
            </Space>
          </Flex>
          {!autoApply && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="AI có thể đọc sai một vài ký tự (đặc biệt là dấu tiếng Việt). Hãy kiểm tra và sửa lại trước khi điền vào biểu mẫu."
            />
          )}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            {FIELD_LABELS.map(({ key, label, highlight }, idx) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  borderBottom:
                    idx < FIELD_LABELS.length - 1 ? "1px solid #f1f5f9" : "none",
                }}
              >
                <div
                  style={{
                    flex: "0 0 170px",
                    padding: "10px 12px",
                    background: highlight
                      ? "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)"
                      : "#f8fafc",
                    color: highlight ? "#1e1b4b" : "#475569",
                    fontWeight: 600,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {label}
                  {highlight && (
                    <Text style={{ color: "#ef4444", marginLeft: 4 }}>*</Text>
                  )}
                </div>
                <div style={{ flex: 1, padding: 8 }}>
                  <Input
                    value={editedResult[key]}
                    onChange={(e) => updateField(key, e.target.value)}
                    placeholder={
                      result[key]
                        ? ""
                        : "AI không đọc được — nhập tay nếu cần"
                    }
                    variant="borderless"
                    style={{
                      fontSize: highlight ? 15 : 14,
                      fontWeight: highlight ? 700 : 400,
                      fontFamily: key === "cccd" ? "monospace" : undefined,
                      color: highlight ? "#1e1b4b" : "#0f172a",
                    }}
                    {...(key === "cccd"
                      ? { maxLength: 12, showCount: true }
                      : {})}
                  />
                </div>
              </div>
            ))}
          </div>
          <Flex justify="end" gap={8} style={{ marginTop: 12 }}>
            <Button onClick={onClose}>Hủy</Button>
            <Button
              icon={<RedoOutlined />}
              onClick={() =>
                setEditedResult({
                  cccd: result.cccd ?? "",
                  fullName: result.fullName ?? "",
                  dateOfBirth: result.dateOfBirth ?? "",
                  gender: result.gender ?? "",
                  nationality: result.nationality ?? "",
                  placeOfOrigin: result.placeOfOrigin ?? "",
                  placeOfResidence: result.placeOfResidence ?? "",
                  dateOfExpiry: result.dateOfExpiry ?? "",
                })
              }
              disabled={!hasEdits}
            >
              Khôi phục
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleApply}
              disabled={!editedResult.cccd && !editedResult.fullName}
            >
              Điền vào biểu mẫu
            </Button>
          </Flex>
        </div>
      )}
    </Modal>
  );
}
