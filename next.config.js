/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lunar-javascript'],
  // Do not ship embedded dependency source/comments in production source maps.
  experimental: { turbopackSourceMaps: false },
  async redirects() {
    return [
      ...['tianji', 'diji', 'renji'].map(section => ({
        source: `/${section}/:path*`, destination: '/knowledge', permanent: true,
      })),
      // Legacy standalone books: 308, including their old chapter paths.
      { source: '/library/gusuifu/:path*', destination: '/library/quanshu/45', permanent: true },
      { source: '/library/quanji/:path*', destination: '/library/quanshu', permanent: true },
    ];
  },
};

module.exports = nextConfig;
