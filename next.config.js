// Worktrees may share node_modules via a symlink outside the project directory.
// Turbopack must see both directories inside its filesystem root.
const path = require('node:path');
const fs = require('node:fs');
let buildRoot = __dirname;
const modulesPath = fs.realpathSync(path.join(__dirname, 'node_modules'));
while (path.relative(buildRoot, modulesPath).startsWith('..')) buildRoot = path.dirname(buildRoot);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root: buildRoot },
  // Preserve prefetch/RSC headers and _rsc for the visit logger's exclusion checks.
  skipProxyUrlNormalize: true,
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
