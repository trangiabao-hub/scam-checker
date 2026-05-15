import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider, theme } from "antd";
import viVN from "antd/locale/vi_VN";
import "./index.css";
import App from "./App.jsx";

const FONT =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ConfigProvider
      locale={viVN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#6366f1",
          colorInfo: "#06b6d4",
          colorSuccess: "#10b981",
          colorWarning: "#f59e0b",
          colorError: "#f43f5e",
          colorBgBase: "#08090e",
          colorBgContainer: "#12141f",
          colorBgElevated: "#1a1d2e",
          colorBgLayout: "#08090e",
          colorTextBase: "#f0f2ff",
          colorTextSecondary: "#8892b0",
          colorBorder: "rgba(255, 255, 255, 0.07)",
          colorBorderSecondary: "rgba(255, 255, 255, 0.04)",
          borderRadius: 12,
          fontFamily: FONT,
          fontSize: 14,
          wireframe: false,
          controlHeight: 44,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
          boxShadowSecondary: "0 12px 40px rgba(0, 0, 0, 0.6)",
        },
        components: {
          Card: {
            borderRadiusLG: 20,
            paddingLG: 20,
            colorBgContainer: "#12141f",
            colorBorderSecondary: "rgba(255, 255, 255, 0.07)",
          },
          Button: {
            borderRadius: 12,
            controlHeight: 44,
            controlHeightLG: 52,
            fontWeight: 600,
          },
          Input: {
            borderRadius: 12,
            controlHeight: 44,
            controlHeightLG: 52,
            colorBgContainer: "#161824",
            colorBorder: "rgba(255,255,255,0.1)",
            activeBorderColor: "#6366f1",
            hoverBorderColor: "rgba(99, 102, 241, 0.5)",
          },
          Tag: {
            borderRadiusSM: 8,
          },
          Tabs: {
            cardBg: "transparent",
            itemColor: "#8892b0",
            itemSelectedColor: "#6366f1",
            itemHoverColor: "#f0f2ff",
          },
          Modal: {
            borderRadiusLG: 20,
            colorBgElevated: "#1a1d2e",
          },
          Alert: {
            borderRadiusLG: 14,
          },
          Descriptions: {
            borderRadiusLG: 14,
            colorBgContainer: "#161824",
          },
          Typography: {
            colorTextHeading: "#f0f2ff",
            colorText: "#f0f2ff",
            colorTextSecondary: "#8892b0",
          }
        },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
);
