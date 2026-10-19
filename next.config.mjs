/**
 * Two build targets from one codebase:
 *  - local (`npm run dev` / `npm run build`): SQLite file (better-sqlite3) + Puppeteer for PDFs
 *  - Cloudflare (`npm run cf:build`, sets CF_BUILD=1): D1 database + Browser Rendering for PDFs
 * The Cloudflare build swaps the two "*.local" driver modules at bundle time, so native
 * Node modules never end up in the Worker.
 */
const isCloudflareBuild = process.env.CF_BUILD === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3", "puppeteer"],
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config, { webpack }) => {
    if (isCloudflareBuild) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^\.\/(driver|browser)\.local$/, (resource) => {
          resource.request = resource.request
            .replace(/driver\.local$/, "driver.d1")
            .replace(/browser\.local$/, "browser.cf");
        })
      );
    }
    return config;
  },
};

export default nextConfig;
