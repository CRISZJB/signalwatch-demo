"use client";

import { useEffect } from "react";

/**
 * 浏览器辅助调度：仅在页面打开时触发 /api/scheduler/tick。
 * 关闭浏览器后不会继续跑——长期调度请使用：
 * - ENABLE_SERVER_SCHEDULER=1（Next 进程内）
 * - 或 `npm run scheduler:worker` / 外部 cron
 */
export function SchedulerPing() {
  useEffect(() => {
    const tick = () => {
      fetch("/api/scheduler/tick", { method: "POST" }).catch(() => undefined);
    };
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);
  return null;
}
