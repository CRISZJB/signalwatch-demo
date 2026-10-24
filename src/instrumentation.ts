/**
 * Next.js 服务端启动钩子：在 Node 进程内启动调度循环。
 * 不依赖浏览器；关闭浏览器后只要 `next start` / `next dev` 进程仍在，就会继续 tick。
 *
 * 启用条件：ENABLE_SERVER_SCHEDULER=1
 * 注意：线上多实例部署需改用外部 cron + /api/scheduler/tick，避免重复调度；
 *       runSchedulerTick 内已有短时锁，可降低重复风险但不能替代单实例/分布式锁。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  try {
    const { hydrateMarketState } = await import("@/lib/market-data");
    await hydrateMarketState();
    console.info("[SignalWatch] 模拟行情演示状态已尝试从数据库恢复");
  } catch (err) {
    console.warn("[SignalWatch] 行情状态恢复跳过", err);
  }

  if (process.env.ENABLE_SERVER_SCHEDULER !== "1") {
    console.info("[SignalWatch] 服务端调度未启用（设置 ENABLE_SERVER_SCHEDULER=1 可开启）");
    return;
  }

  const intervalMs = Math.max(10_000, Number(process.env.SCHEDULER_INTERVAL_MS || 20_000));
  console.info(`[SignalWatch] 服务端调度已启用，间隔 ${intervalMs}ms`);

  const { runSchedulerTick } = await import("@/lib/task-service");

  const tick = async () => {
    try {
      await runSchedulerTick();
    } catch (err) {
      console.error("[SignalWatch] scheduler tick error", err);
    }
  };

  // 延迟首轮，避免与启动竞态
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), intervalMs);
  }, 3000);
}
