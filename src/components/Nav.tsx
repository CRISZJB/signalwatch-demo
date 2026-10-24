"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "总览" },
  { href: "/create", label: "创建监控" },
  { href: "/tasks", label: "任务列表" },
  { href: "/alerts", label: "预警中心" },
  { href: "/market", label: "模拟行情" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sw-nav">
      <div className="sw-brand">
        <div className="sw-brand-mark" aria-hidden />
        <div>
          <h1>SignalWatch</h1>
          <p>智能投资监控与风险雷达</p>
        </div>
      </div>
      <nav className="sw-nav-links">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href)) ? "active" : ""}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <span className="sw-badge">数据模式：SIMULATED 模拟</span>
    </header>
  );
}
