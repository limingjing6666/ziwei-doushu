/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lunar-javascript'],
  // Do not ship embedded dependency source/comments in production source maps.
  experimental: { turbopackSourceMaps: false },
  async redirects() {
    return ['tianji', 'diji', 'renji'].map(section => ({
      source: `/${section}/:path*`, destination: '/knowledge', permanent: true,
    }));
  },
};

module.exports = nextConfig;
