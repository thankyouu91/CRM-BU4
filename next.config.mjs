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

// The game (public/ta-tua/game, shown in an iframe on /ta-tua) is a separate document: it may be
// framed by this origin and loads its two Google Fonts. In production these files are served as
// static assets and carry no headers at all; this keeps `next dev` behaving the same way.
const gameHeaders = [
  { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'self'; base-uri 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig = {
  poweredByHeader: false,
  // Packages with a "workerd" export condition, which OpenNext copies whole and bundles for
  // the Worker: Prisma's generated client, and pg-cloudflare (the socket `pg` uses on Workers;
  // Turbopack's file tracing only keeps its Node.js stub).
  serverExternalPackages: ["@prisma/client", ".prisma/client", "pg-cloudflare"],
  experimental: {
    // Request bodies pass through middleware, which cuts them at 10 MB by default;
    // contract PDF uploads take up to MAX_UPLOAD_BYTES (lib/contract-files.ts).
    proxyClientMaxBodySize: "27mb",
  },
  async headers() {
    return [
      { source: "/((?!ta-tua/game/).*)", headers: securityHeaders },
      { source: "/ta-tua/game/:path*", headers: gameHeaders },
      // Public presentation links carry their token in the path: send no Referer at all.
      { source: "/((?!share/).*)", headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] },
      { source: "/share/:token", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

// Local development: the game server runs separately (npm run petdex:dev, port 3200) and Next
// proxies its API; on Cloudflare the Worker routes /ta-tua/api to the Durable Object instead.
if (!isProd) {
  const gameOrigin = process.env.PETDEX_URL ?? "http://127.0.0.1:3200";
  nextConfig.rewrites = async () => [{ source: "/ta-tua/api/:path*", destination: `${gameOrigin}/ta-tua/api/:path*` }];
}

export default nextConfig;
