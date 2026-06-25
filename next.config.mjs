/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hearth is self-hosted and shipped as a container image.
  output: "standalone",
};

export default nextConfig;
