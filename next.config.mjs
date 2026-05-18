/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["10.0.0.251"],
  output: "standalone",
  serverExternalPackages: [
    "postgres",
    "bcrypt",
    "jsonwebtoken",
  ],
};

export default nextConfig;
