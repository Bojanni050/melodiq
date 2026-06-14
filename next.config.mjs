import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const pad2 = (value) => String(value).padStart(2, "0");
const buildNow = new Date();
const buildVersion = `0.${buildNow.getFullYear()}${pad2(buildNow.getMonth() + 1)}${pad2(buildNow.getDate())}${pad2(buildNow.getHours())}${pad2(buildNow.getMinutes())}`;
const uploadProxyLimitMb = Number.parseInt(process.env.UPLOAD_PROXY_MAX_BODY_MB || "200", 10);
const uploadProxyLimitBytes = Number.isFinite(uploadProxyLimitMb) && uploadProxyLimitMb > 0
  ? uploadProxyLimitMb * 1024 * 1024
  : 200 * 1024 * 1024;

const nextConfig = {
  allowedDevOrigins: ["10.0.0.251"],
  output: "standalone",
  experimental: {
    proxyClientMaxBodySize: uploadProxyLimitBytes,
  },
  env: {
    NEXT_PUBLIC_BUILD_VERSION: buildVersion,
  },
  serverExternalPackages: [
    "postgres",
    "bcrypt",
    "jsonwebtoken",
  ],
  turbopack: {}, // Silence webpack/turbopack warning for next-pwa
};

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  customWorkerSrc: 'worker',
})(nextConfig);
