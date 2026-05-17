/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "postgres",
    "bcrypt",
    "jsonwebtoken",
    "pg",
  ],
};

export default nextConfig;
