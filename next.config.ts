import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 启用 src/instrumentation.ts（服务端调度可选开关）
  experimental: {
    // Next 15 默认支持 instrumentation；显式保留注释说明用途
  },
};

export default nextConfig;
