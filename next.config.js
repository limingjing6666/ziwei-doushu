/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lunar-javascript'],
  async redirects() {
    return ['tianji', 'diji', 'renji'].map(section => ({
      source: `/${section}/:path*`, destination: '/knowledge', permanent: true,
    }));
  },
};

module.exports = nextConfig;
