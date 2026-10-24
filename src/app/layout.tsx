import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { SchedulerPing } from "@/components/SchedulerPing";

export const metadata: Metadata = {
  title: "SignalWatch · 智能投资监控与风险雷达",
  description: "自然语言转监控规则，可调度、可解释、可追溯",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="sw-shell">
          <Nav />
          <SchedulerPing />
          {children}
          <footer
            className="sw-muted"
            style={{ marginTop: 40, fontSize: "0.8rem", lineHeight: 1.6, borderTop: "1px solid var(--line)", paddingTop: 16 }}
          >
            合规提示：本产品为技术演示，展示内容不构成投资建议；默认行情/事件/日历为 SIMULATED
            模拟数据，非实时行情，关键结论请以执行日志中的数据快照与规则版本为准。
          </footer>
        </div>

      </body>
    </html>
  );
}
