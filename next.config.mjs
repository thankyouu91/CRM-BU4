/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy: everything the app loads is its own (fonts are
// self-hosted by next/font, exports are built in the browser). Next.js inlines
// its bootstrap scripts and styles, and the login page is prerendered, so
// per-request nonces are not possible without making every page dynamic;
// 'unsafe-inline' is allowed for scripts and styles, but only from this origin.
// Dev mode also needs eval (React Refresh) and websockets (HMR).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
  // Contract PDFs open from /api/contracts/... (same origin), also in an embedded viewer.
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig = {
  poweredByHeader: false,
  // Bundle Prisma's generated client for the workerd runtime (OpenNext).
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  experimental: {
    // Request bodies pass through middleware, which cuts them at 10 MB by default;
    // contract PDF uploads take up to MAX_UPLOAD_BYTES (lib/contract-files.ts).
    middlewareClientMaxBodySize: "27mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      // pptxgenjs lazily imports node:fs / node:https on its Node-only code paths.
      // They never run in the browser; strip the scheme and stub the modules.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, https: false };
    }
    return config;
  },
};

export default nextConfig;
