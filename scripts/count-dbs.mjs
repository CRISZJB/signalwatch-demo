import { PrismaClient } from "@prisma/client";

const urls = [
  "file:C:/Users/Cris.Z/Desktop/同花顺/第一题/signalwatch/prisma/dev.db",
  "file:C:/Users/Cris.Z/Desktop/同花顺/第一题/signalwatch/submission/evidence/isolated-smoke.db",
  "file:C:/Users/Cris.Z/Desktop/同花顺/第一题/signalwatch/submission/evidence/isolated-submission.db",
];

for (const url of urls) {
  try {
    const p = new PrismaClient({ datasources: { db: { url } } });
    const tasks = await p.task.count();
    const execs = await p.executionLog.count();
    const alerts = await p.alert.count();
    console.log(JSON.stringify({ url, tasks, execs, alerts }));
    await p.$disconnect();
  } catch (e) {
    console.log(JSON.stringify({ url, error: e.message }));
  }
}
