import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
// The build number is read by people in the Netherlands, but the image is
// built in a container that runs on UTC. Formatting with the build machine's
// clock therefore showed a time one hour behind in winter (two in summer), so
// the timestamp is pinned to Europe/Amsterdam instead of the host timezone.
const buildNow = new Date();
const buildParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).formatToParts(buildNow);
const buildPart = (type) => buildParts.find((part) => part.type === type)?.value ?? "00";
const buildVersion = `0.${buildPart("year")}${buildPart("month")}${buildPart("day")}${buildPart("hour")}${buildPart("minute")}`;
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
