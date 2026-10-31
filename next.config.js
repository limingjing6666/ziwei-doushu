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
