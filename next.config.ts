import type { NextConfig } from "next";

/**
 * Headers de segurança (incrementais, sem CSP quebradiça):
 * - nosniff barra MIME-sniffing (reforça o allowlist de upload);
 * - DENY barra clickjacking do painel;
 * - Referrer/Permissions mínimos (sem câmera/mic/geolocalização).
 * HSTS fica com a Vercel (HTTPS forçado por padrão).
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  serverActions: {
    bodySizeLimit: "5mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
