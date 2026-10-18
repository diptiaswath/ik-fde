/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The `pg` package must not be bundled by webpack on the server.
    serverComponentsExternalPackages: ["pg"],
  },
};

export default nextConfig;
