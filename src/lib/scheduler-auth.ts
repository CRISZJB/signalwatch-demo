/**
 * 调度接口鉴权：
 * - 若设置了 SCHEDULER_SECRET，则请求头必须带 x-scheduler-secret
 * - 未设置时允许本地开发调用（并应在文档中说明生产必须配置密钥）
 */
export function authorizeScheduler(req: Request): { ok: boolean; reason: string } {
  const secret = process.env.SCHEDULER_SECRET?.trim();
  if (!secret) {
    return { ok: true, reason: "DEV_OPEN_NO_SECRET" };
  }
  const hdr = req.headers.get("x-scheduler-secret")?.trim();
  if (hdr && hdr === secret) {
    return { ok: true, reason: "SECRET_OK" };
  }
  return { ok: false, reason: "UNAUTHORIZED" };
}
