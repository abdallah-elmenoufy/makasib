import { describe, expect, it } from "vitest";
import { bodyFor, carSvg, paintFor, PAINTS } from "@/lib/carRender";
import { catalogCategory } from "@/lib/carCatalog";

describe("paintFor", () => {
  it("reads stored keys, English and Arabic words, and hex", () => {
    expect(paintFor("SILVER").key).toBe("SILVER");
    expect(paintFor("Light Blue").key).toBe("LIGHT_BLUE");
    expect(paintFor("light blue metallic").key).toBe("LIGHT_BLUE");
    expect(paintFor("فضي").key).toBe("SILVER");
    expect(paintFor("لبني").key).toBe("LIGHT_BLUE");
    expect(paintFor("#123456").hex).toBe("#123456");
    expect(paintFor(null).hex).toBe(PAINTS.SILVER.hex);
  });
});

describe("body type", () => {
  it("comes from the catalog by make/model", () => {
    expect(bodyFor(catalogCategory("Speranza", "A516"))).toBe("SEDAN");
    expect(bodyFor(catalogCategory("Kia", "Sportage"))).toBe("SUV");
    expect(bodyFor(catalogCategory("Hyundai", "i10"))).toBe("HATCHBACK");
    expect(bodyFor(catalogCategory("Nobody", "Unknown"))).toBe("SEDAN");
  });
});

describe("carSvg", () => {
  it("never interpolates anything but a validated hex and escapes the title", () => {
    const svg = carSvg("SEDAN", "red;}<script>", "x1", { title: "<b>Car</b>" });
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("<b>");
    expect(svg).toContain(PAINTS.SILVER.hex.slice(0, 3));
  });
});
