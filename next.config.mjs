import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const pad2 = (value) => String(value).padStart(2, "0");
const buildNow = new Date();
const buildVersion = `0.${buildNow.getFullYear()}${pad2(buildNow.getMonth() + 1)}${pad2(buildNow.getDate())}${pad2(buildNow.getHours())}${pad2(buildNow.getMinutes())}`;

const nextConfig = {
  allowedDevOrigins: ["10.0.0.251"],
  output: "standalone",
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
})(nextConfig);
