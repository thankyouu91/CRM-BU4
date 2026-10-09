/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production"
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
    middlewareClientMaxBodySize: "26mb",
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
