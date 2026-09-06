import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SGA-M · Gestão de Ativos, Manutenção e Suprimentos",
    short_name: "SGA-M",
    description:
      "Plataforma operacional: QR Code, ordens de serviço, compras e auditoria.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
