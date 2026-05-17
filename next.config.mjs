/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "postgres",
    "bcrypt",
    "jsonwebtoken",
  ],
};

export default nextConfig;
