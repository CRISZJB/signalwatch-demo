/**
 * 独立于浏览器的外部调度进程。
 * 用法：
 *   SCHEDULER_SECRET=xxx BASE_URL=http://localhost:3000 node scripts/scheduler-worker.mjs
 *
 * 关闭浏览器不影响本进程；停止本进程或停止 Next 服务后调度停止。
 * 线上可用系统 cron / 云定时器等价调用 POST /api/scheduler/tick。
 */
const base = process.env.BASE_URL || "http://localhost:3000";
const secret = process.env.SCHEDULER_SECRET || "";
const intervalMs = Math.max(5000, Number(process.env.SCHEDULER_INTERVAL_MS || 15000));
const once = process.argv.includes("--once");

async function tick() {
  const headers = { "Content-Type": "application/json" };
  if (secret) headers["x-scheduler-secret"] = secret;
  const res = await fetch(`${base}/api/scheduler/tick`, { method: "POST", headers });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      status: res.status,
      skipped: data.skipped,
      reason: data.reason,
      resultCount: Array.isArray(data.results) ? data.results.length : undefined,
      auth: data.auth,
    }),
  );
  if (!res.ok) process.exitCode = 1;
  return data;
}

if (once) {
  tick().then(() => process.exit(process.exitCode || 0));
} else {
  console.log(`scheduler-worker started → ${base} every ${intervalMs}ms`);
  tick();
  setInterval(tick, intervalMs);
}
