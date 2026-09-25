import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider, theme } from "antd";
import viVN from "antd/locale/vi_VN";
import "./index.css";
import App from "./App.jsx";
import AuthProvider from "./AuthProvider.jsx";

const FONT_SANS =
  '"Geist Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const FONT_MONO =
  '"Geist Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace';

/*
  Token ở đây phải trùng với biến CSS trong index.css. Cách này để Ant Design
  tự sinh ra màu đúng ngay từ đầu, thay vì ghi đè bằng !important ở tầng CSS.
*/
const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20 };

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ConfigProvider
      locale={viVN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          /* Hành động dùng neutral sáng. colorTextLightSolid phải là màu tối,
             nếu không chữ trên nút chính sẽ là trắng trên trắng. */
          colorPrimary: "#f5f7fa",
          colorPrimaryHover: "#ffffff",
          colorPrimaryActive: "#dfe3e9",
          colorTextLightSolid: "#07090d",

          /* Link và focus dùng xanh thép, là màu nhận diện duy nhất. Info để
             neutral để Alert thông tin không cạnh tranh với màu mức rủi ro. */
          colorLink: "#7aa7e8",
          colorLinkHover: "#9dbeef",
          colorInfo: "#b4bdc9",
          colorError: "#e8595e",
          colorWarning: "#e8b04b",
          colorSuccess: "#4ecb8f",

          colorBgBase: "#07090d",
          colorBgLayout: "#07090d",
          colorBgContainer: "#151a22",
          colorBgElevated: "#1e242e",
          colorBgSpotlight: "#2b3340",

          colorTextBase: "#f5f7fa",
          colorText: "#f5f7fa",
          colorTextSecondary: "#b4bdc9",
          colorTextTertiary: "#8a94a3",
          colorTextQuaternary: "#6f7988",

          colorBorder: "rgba(255, 255, 255, 0.22)",
          colorBorderSecondary: "rgba(255, 255, 255, 0.11)",

          borderRadius: RADIUS.md,
          borderRadiusSM: RADIUS.sm,
          borderRadiusXS: RADIUS.sm,
          borderRadiusLG: RADIUS.lg,

          fontFamily: FONT_SANS,
          fontFamilyCode: FONT_MONO,
          fontSize: 18,

          /* Ô nhập cao thêm để chữ 18px không bị chật trong khung */
          controlHeight: 50,
          controlHeightLG: 56,

          /* Bóng nhuộm theo tông nền thay vì đen nguyên chất */
          boxShadow: "0 1px 2px rgba(3, 4, 7, 0.7)",
          boxShadowSecondary: "0 14px 36px -14px rgba(3, 4, 7, 0.95)",
        },
        components: {
          Card: { borderRadiusLG: RADIUS.lg },
          Button: { borderRadius: RADIUS.md, fontWeight: 500 },
          Input: { borderRadius: RADIUS.md, activeShadow: "none" },
          Modal: { borderRadiusLG: RADIUS.xl },
          Tag: { borderRadiusSM: RADIUS.sm },
          Alert: { borderRadiusLG: RADIUS.md },
          Segmented: { borderRadius: RADIUS.md, itemSelectedBg: "#2b3340" },
          Progress: { defaultColor: "#f5f7fa" },
        },
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConfigProvider>
  </StrictMode>,
);
