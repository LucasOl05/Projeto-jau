import { GraduationCap } from "lucide-react";
import { useState } from "react";

/**
 * Logo da escola. Para trocar por uma imagem real, defina VITE_BRAND_LOGO_URL
 * no .env ou substitua `logoUrl` abaixo pela URL definitiva.
 * Enquanto não houver imagem, exibimos um ícone estilizado como placeholder.
 */
const logoUrl = import.meta.env.VITE_BRAND_LOGO_URL as string | undefined;

export function BrandLogo({
  size = 40,
  rounded = "rounded-xl",
  className = "",
}: {
  size?: number;
  rounded?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt="Logo JAU"
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={`${rounded} object-contain ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`${rounded} flex items-center justify-center bg-primary text-primary-foreground shadow-sm ${className}`}
      style={{ width: size, height: size }}
      aria-label="JAU"
    >
      <GraduationCap className="h-1/2 w-1/2" />
    </div>
  );
}