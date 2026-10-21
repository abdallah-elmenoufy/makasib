"use client";
import { useId, useMemo } from "react";
import { bodyFor, carSvg, paintFor, PAINTS } from "@/lib/carRender";
import { catalogCategory } from "@/lib/carCatalog";

/** A studio-style render of the car in its real colour and body type. */
export function CarRender({
  make,
  model,
  category,
  color,
  className = "",
  title,
  shadow = true,
}: {
  make?: string | null;
  model?: string | null;
  category?: string | null;
  color?: string | null;
  className?: string;
  title?: string;
  shadow?: boolean;
}) {
  const uid = useId();
  const svg = useMemo(() => {
    const body = bodyFor(category ?? catalogCategory(make, model));
    return carSvg(body, paintFor(color).hex, `car${uid}`, { title, shadow });
  }, [category, make, model, color, uid, title, shadow]);
  return (
    <span
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={`block [&>svg]:w-full [&>svg]:h-auto ${className}`}
      // carSvg only interpolates enums, a validated hex and an escaped title
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** "Silver" / "فضي" for a stored paint key; free text as typed otherwise. */
export function colorLabel(color: string | null | undefined, locale: string): string | null {
  if (!color) return null;
  const { key } = paintFor(color);
  if (key && PAINTS[key] && (color.toUpperCase().replace(/[\s-]+/g, "_") === key)) return locale === "ar" ? PAINTS[key].ar : PAINTS[key].en;
  return color;
}

/** "Silver Chevrolet Optra" — the line under the plate on Uber's driver card. */
export function carTitle(v: { make?: string | null; model?: string | null; color?: string | null; name?: string | null }, locale: string): string {
  const parts = [colorLabel(v.color, locale), v.make, v.model].filter(Boolean);
  return parts.length > 1 ? parts.join(" ") : v.name ?? parts.join(" ");
}
