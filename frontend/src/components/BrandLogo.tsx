import { useState } from "react";
import { brand } from "@/theme/brand";
import { cn } from "@/lib/utils";

export function BrandLogo({
  variant,
  className,
}: {
  variant: "full" | "mark";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = variant === "full" ? brand.identity.logo : brand.identity.logoMark;
  const mono = brand.identity.shortName.slice(0, 1).toUpperCase();

  if (failed || !src) {
    return (
      <span
        className={cn(
          "grid place-items-center rounded-md bg-primary text-primary-foreground font-semibold shadow-db-lg",
          className
        )}
      >
        {mono}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={brand.identity.appName}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
