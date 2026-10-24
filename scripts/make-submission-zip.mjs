import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const proj = path.join(__dirname, "..");
const root = path.join(proj, "..");
const stage = path.join(root, "_sw_pack_stage");
const zipPath = path.join(root, "SignalWatch_第一题_正式提交.zip");
const mkvSrc = path.join(root, "SignalWatch_第一题演示.mkv");

if (fs.existsSync(zipPath)) {
  console.error("ZIP already exists, abort without overwrite:", zipPath);
  process.exit(2);
}
if (!fs.existsSync(mkvSrc)) {
  console.error("MKV missing:", mkvSrc);
  process.exit(3);
}

fs.rmSync(stage, { recursive: true, force: true });
const outDir = path.join(stage, "SignalWatch_第一题_正式提交");
fs.mkdirSync(path.join(outDir, "evidence"), { recursive: true });

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

copy(mkvSrc, path.join(outDir, "SignalWatch_第一题演示.mkv"));
copy(path.join(proj, "README.md"), path.join(outDir, "README.md"));
copy(
  path.join(proj, "submission", "01_AI使用与验证记录.md"),
  path.join(outDir, "01_AI使用与验证记录.md"),
);
copy(
  path.join(proj, "submission", "02_测试说明与结果.md"),
  path.join(outDir, "02_测试说明与结果.md"),
);
copy(
  path.join(proj, "submission", "03_关键数字与结论追溯.md"),
  path.join(outDir, "03_关键数字与结论追溯.md"),
);
copy(path.join(proj, "submission", "提交清单.md"), path.join(outDir, "提交清单.md"));
copy(
  path.join(proj, "submission", "evidence", "EVIDENCE_INDEX.md"),
  path.join(outDir, "evidence", "EVIDENCE_INDEX.md"),
);

const evidenceKeep = [
  "r4-01-vitest.utf8.txt",
  "r4-01-vitest.log",
  "r4-02-typecheck.utf8.txt",
  "r4-02-typecheck.log",
  "r4-03-lint.utf8.txt",
  "r4-03-lint.log",
  "r4-04-build.utf8.txt",
  "r4-04-build.log",
  "r4-run-summary.json",
  "r3-01-vitest.utf8.txt",
  "r3-02-typecheck.utf8.txt",
  "r3-03-lint.utf8.txt",
  "r3-04-build.utf8.txt",
  "r3-01-vitest.CORRUPT-utf16le.legacy.bin",
  "r3-02-typecheck.CORRUPT-utf16le.legacy.bin",
  "r3-03-lint.CORRUPT-utf16le.legacy.bin",
  "r3-04-build.CORRUPT-utf16le.legacy.bin",
  "r3-05-public-health.json",
  "r3-06-public-stats.json",
  "r3-06-public-stats.summary.json",
  "r3-run-summary.json",
  "dedup-evidence.json",
  "isolated-flow-evidence.json",
  "scheduler-verify.json",
  "scheduler-verify.utf8.txt",
  "run-summary.json",
  "r2-01-vitest.utf8.txt",
  "r2-05-dedup.utf8.txt",
];

const missing = [];
for (const f of evidenceKeep) {
  const s = path.join(proj, "submission", "evidence", f);
  if (fs.existsSync(s)) copy(s, path.join(outDir, "evidence", f));
  else missing.push(f);
}

fs.writeFileSync(
  path.join(outDir, "PACKAGING_README.txt"),
  [
    "SignalWatch 第一题正式提交包",
    `generatedAtUtc: ${new Date().toISOString()}`,
    "github: https://github.com/CRISZJB/signalwatch-demo",
    "demo: https://signalwatch-sfkf.onrender.com",
    "businessCommit: 233d09d715deb06c5a2ec70b7141f107a741ea16",
    "video: SignalWatch_第一题演示.mkv (MKV; not uploaded to GitHub)",
    "note: full source is on GitHub; this ZIP = docs + evidence + demo video",
    missing.length ? `missingOptionalEvidence: ${missing.join(", ")}` : "missingOptionalEvidence: none",
    "",
  ].join("\n"),
  "utf8",
);

const ps = `
$ErrorActionPreference = 'Stop'
Compress-Archive -LiteralPath '${outDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -CompressionLevel Optimal
`;
const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});
if (r.status !== 0) {
  console.error(r.stdout);
  console.error(r.stderr);
  process.exit(1);
}

const st = fs.statSync(zipPath);
console.log(
  JSON.stringify(
    {
      zipPath,
      zipBytes: st.size,
      zipMB: +(st.size / 1024 / 1024).toFixed(3),
      mkvBytes: fs.statSync(mkvSrc).size,
      missing,
    },
    null,
    2,
  ),
);
