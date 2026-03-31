import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider } from "antd";
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
        token: {
          colorPrimary: "#4f46e5",
          colorInfo: "#4f46e5",
          colorSuccess: "#10b981",
          colorWarning: "#f59e0b",
          colorError: "#ef4444",
          colorLink: "#4f46e5",
          borderRadius: 12,
          fontFamily: FONT,
          fontSize: 14,
          wireframe: false,
          colorBgContainer: "#ffffff",
          colorBgElevated: "#ffffff",
          controlHeight: 40,
          boxShadow:
            "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
          boxShadowSecondary:
            "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
        },
        components: {
          Card: {
            borderRadiusLG: 20,
            paddingLG: 24,
          },
          Button: {
            borderRadius: 12,
            controlHeight: 42,
            controlHeightLG: 48,
            fontWeight: 600,
          },
          Input: {
            borderRadius: 12,
            controlHeight: 42,
            controlHeightLG: 48,
          },
          Tag: {
            borderRadiusSM: 8,
          },
          Tabs: {
            cardBg: "transparent",
          },
          Modal: {
            borderRadiusLG: 20,
          },
          Alert: {
            borderRadiusLG: 14,
          },
          Descriptions: {
            borderRadiusLG: 14,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
);
