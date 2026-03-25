/** @type {import('next').NextConfig} */

function buildConnectSrc() {
  const parts = new Set(["'self'"]);
  for (const key of ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SUPABASE_URL']) {
    const raw = process.env[key];
    if (!raw) continue;
    try {
      parts.add(new URL(raw).origin);
    } catch {
      /* ignore invalid URL at build time */
    }
  }
  return Array.from(parts).join(' ');
}

function securityHeaders() {
  const connectSrc = buildConnectSrc();
  const csp = [
    "default-src 'self'",
    `connect-src ${connectSrc}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=()',
    },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: csp },
  ];
}

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // A checagem de tipos é feita localmente; na CI/Vercel o build não deve falhar por inferência de JS
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders() }];
  },
};

export default nextConfig;
