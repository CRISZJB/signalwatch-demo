const base = process.env.BASE_URL || "http://localhost:3000";

async function req(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    redirect: "follow",
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`${opts.method || "GET"} ${path} -> ${res.status} ${text}`);
  return data;
}

async function main() {
  const parse = await req("/api/parse", {
    method: "POST",
    body: JSON.stringify({ text: "贵州茅台跌破1700元提醒我" }),
  });
  console.log("PARSE", parse.success, parse.confidence, parse.warnings);

  const created = await req("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      name: "演示-茅台跌破1700",
      naturalLanguage: "贵州茅台跌破1700元提醒我",
      rule: parse.rule,
      cooldownMinutes: 30,
      scheduleIntervalSec: 30,
    }),
  });
  const tid = created.task.id;
  console.log("CREATE", tid, created.task.status);

  await req("/api/market", {
    method: "POST",
    body: JSON.stringify({
      action: "override",
      symbol: "600519",
      patch: { price: 1650, prevClose: 1720, changePct: -4.07 },
    }),
  });

  const run1 = await req(`/api/tasks/${tid}/run`, { method: "POST", body: "{}" });
  console.log("RUN1", run1.log.outcome, "alert=", Boolean(run1.alert));

  const run2 = await req(`/api/tasks/${tid}/run`, { method: "POST", body: "{}" });
  console.log("RUN2", run2.log.outcome, run2.log.skipReason);

  await req(`/api/tasks/${tid}/pause`, { method: "POST", body: "{}" });
  const run3 = await req(`/api/tasks/${tid}/run`, { method: "POST", body: "{}" });
  console.log("RUN3 paused", run3.log.outcome);

  await req(`/api/tasks/${tid}/resume`, { method: "POST", body: "{}" });

  const rule2 = structuredClone(parse.rule);
  if (rule2.condition.type === "price") rule2.condition.threshold = 1600;
  const upd = await req(`/api/tasks/${tid}`, {
    method: "PUT",
    body: JSON.stringify({ rule: rule2, changeNote: "阈值改为1600" }),
  });
  console.log("VERSION", upd.task.currentVersion);

  await req("/api/market", {
    method: "POST",
    body: JSON.stringify({ action: "setFault", mode: "timeout" }),
  });
  const run4 = await req(`/api/tasks/${tid}/run`, {
    method: "POST",
    body: JSON.stringify({ force: true }),
  });
  const detail = await req(`/api/tasks/${tid}`);
  console.log("DEGRADE", run4.log.outcome, detail.task.status);

  await req("/api/market", {
    method: "POST",
    body: JSON.stringify({ action: "setFault", mode: "none" }),
  });
  await req("/api/market", {
    method: "POST",
    body: JSON.stringify({ action: "clearOverride" }),
  });
  const run5 = await req(`/api/tasks/${tid}/run`, {
    method: "POST",
    body: JSON.stringify({ force: true }),
  });
  const detail2 = await req(`/api/tasks/${tid}`);
  console.log(
    "RECOVER",
    run5.log.outcome,
    detail2.task.status,
    "execs=",
    detail2.task.executions.length,
    "versions=",
    detail2.task.versions.length,
  );

  const stats = await req("/api/stats");
  console.log("STATS", {
    tasks: stats.taskCount,
    alerts: stats.alertCount,
    execs: stats.execCount,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
