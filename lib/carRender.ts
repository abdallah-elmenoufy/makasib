// Studio-style 3/4 car renders as SVG — the look of the car cards in Uber's
// rider app, drawn rather than photographed so every car in the catalog
// gets one in its real paint colour, offline, at any size, in both themes.
//
// One function, pure: (body type, paint) → SVG markup. Shading is built from
// the paint: a lit top, the true colour at the waist, a darker sill, a darker
// front face turned away from the light, tinted glass with a sky reflection,
// alloy wheels, and a soft contact shadow.

export type BodyType = "SEDAN" | "HATCHBACK" | "SUV" | "MPV";

/** Common Egyptian car colours → paint hex. Keys are what the car form stores. */
export const PAINTS: Record<string, { hex: string; ar: string; en: string }> = {
  WHITE: { hex: "#f1f2f0", en: "White", ar: "أبيض" },
  SILVER: { hex: "#b9bec4", en: "Silver", ar: "فضي" },
  GREY: { hex: "#6e747b", en: "Grey", ar: "رمادي" },
  BLACK: { hex: "#22252a", en: "Black", ar: "أسود" },
  RED: { hex: "#b3202a", en: "Red", ar: "أحمر" },
  BURGUNDY: { hex: "#6b1f2a", en: "Burgundy", ar: "نبيتي" },
  BLUE: { hex: "#1f4f9a", en: "Blue", ar: "أزرق" },
  LIGHT_BLUE: { hex: "#8db4dc", en: "Light blue", ar: "لبني" },
  NAVY: { hex: "#1c2a4a", en: "Navy", ar: "كحلي" },
  GREEN: { hex: "#2f6b45", en: "Green", ar: "أخضر" },
  GOLD: { hex: "#c9a24a", en: "Gold", ar: "ذهبي" },
  BEIGE: { hex: "#d6c6a4", en: "Beige", ar: "بيج" },
  BROWN: { hex: "#6a4a33", en: "Brown", ar: "بني" },
  ORANGE: { hex: "#d9661f", en: "Orange", ar: "برتقالي" },
  YELLOW: { hex: "#e5c22c", en: "Yellow", ar: "أصفر" },
};

/** Understands the stored key, an English or Arabic colour word, or a hex. */
export function paintFor(color: string | null | undefined): { key: string | null; hex: string } {
  const raw = (color ?? "").trim();
  if (!raw) return { key: null, hex: PAINTS.SILVER.hex };
  if (/^#[0-9a-f]{6}$/i.test(raw)) return { key: null, hex: raw };
  const up = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (PAINTS[up]) return { key: up, hex: PAINTS[up].hex };
  const low = raw.toLowerCase();
  // longest names first so "light blue" wins over "blue"
  const entries = Object.entries(PAINTS).sort((a, b) => b[1].en.length - a[1].en.length);
  for (const [key, p] of entries) {
    if (low.includes(p.en.toLowerCase()) || raw.includes(p.ar)) return { key, hex: p.hex };
  }
  const extra: [RegExp, string][] = [
    [/gray|رصاص/i, "GREY"],
    [/maroon|نبيتى|عنابي/i, "BURGUNDY"],
    [/sky|baby blue|لبنى/i, "LIGHT_BLUE"],
    [/champagne|شامبين/i, "BEIGE"],
    [/فضى/, "SILVER"],
  ];
  for (const [re, key] of extra) if (re.test(raw)) return { key, hex: PAINTS[key].hex };
  return { key: null, hex: PAINTS.SILVER.hex };
}

/** Catalog category → body to draw. */
export function bodyFor(category: string | null | undefined): BodyType {
  const c = (category ?? "").toUpperCase();
  if (c === "HATCHBACK" || c === "SUV" || c === "MPV") return c;
  return "SEDAN";
}

// ---------------------------------------------------------------------------
// colour maths
function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
function luminance(h: string): number {
  const [r, g, b] = hexToRgb(h).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ---------------------------------------------------------------------------
// geometry per body. viewBox 0 0 480 250; the car faces right, seen from the
// front-left at eye level, so the near side runs left→right and the nose is
// a narrow angled face on the right.
type Geo = {
  side: string; // near-side body silhouette (without the nose face)
  face: string; // the nose, turned away from the light
  hood: string; // top of the bonnet, catching light
  roof: string; // sliver of roof top
  glass: string; // near-side windows
  windshield: string;
  pillar: number; // x of the B-pillar
  pillar2?: number; // x of a C-pillar for 3-row bodies
  belt: number; // y of the waist line (shoulder highlight)
  doors: string; // door shut lines
  rearWheel: [number, number, number];
  frontWheel: [number, number, number];
  farWheel: [number, number, number];
  headlight: string;
  farHeadlight: string;
  grille: string;
  taillight: string;
  mirror: string;
  sill: string;
  /** SUV: black plastic arch cladding and roof rails */
  rugged?: boolean;
};

const GEO: Record<BodyType, Geo> = {
  SEDAN: {
    side: "M58 186 L50 168 Q44 140 54 128 L84 120 L134 112 C156 86 176 74 204 70 L266 68 C288 70 306 84 324 102 L366 110 Q382 114 386 128 L388 176 L362 186 C360 160 342 142 320 142 C296 142 280 160 278 184 L162 188 C160 164 142 148 120 148 C98 148 82 164 80 186 Z",
    face: "M366 110 L446 118 Q456 122 458 134 L458 170 L432 182 L388 186 L386 128 Q382 114 366 110 Z",
    hood: "M324 102 L366 110 L446 118 L398 99 L338 96 Z",
    roof: "M204 70 L266 68 L292 65 L236 66 Z",
    glass: "M150 110 C168 88 184 78 206 76 L262 75 C280 77 296 88 310 104 Z",
    windshield: "M266 68 L292 65 L398 99 L338 96 C322 84 296 70 266 68 Z",
    pillar: 234,
    belt: 116,
    doors: "M234 112 L232 182 M150 112 L156 176 M318 106 L320 140",
    rearWheel: [120, 184, 30],
    frontWheel: [320, 182, 33],
    farWheel: [440, 178, 15],
    headlight: "M388 132 L424 128 Q432 130 430 138 L392 144 Z",
    farHeadlight: "M440 126 L452 128 L452 136 L442 136 Z",
    grille: "M398 148 L438 144 L440 160 L400 164 Z",
    taillight: "M52 134 L72 128 L74 140 L54 146 Z",
    mirror: "M300 100 L318 98 L320 110 L304 110 Z",
    sill: "M120 186 L320 184 L330 190 L118 192 Z",
  },
  HATCHBACK: {
    side: "M86 186 L80 166 Q78 128 90 110 L106 90 C124 74 152 68 190 66 L262 66 C284 68 302 82 320 100 L362 110 Q378 114 382 128 L384 176 L358 186 C356 160 338 142 316 142 C292 142 276 160 274 184 L178 188 C176 164 158 148 136 148 C114 148 98 164 96 186 Z",
    face: "M362 110 L440 118 Q450 122 452 134 L452 170 L428 182 L384 186 L382 128 Q378 114 362 110 Z",
    hood: "M320 100 L362 110 L440 118 L392 97 L334 94 Z",
    roof: "M150 68 L262 66 L288 63 L176 64 Z",
    glass: "M110 102 C124 84 152 74 192 72 L258 72 C276 74 292 86 306 102 Z",
    windshield: "M262 66 L288 63 L392 97 L334 94 C318 82 292 68 262 66 Z",
    pillar: 222,
    pillar2: 150,
    belt: 112,
    doors: "M222 108 L220 182 M150 108 L156 176 M314 104 L316 140",
    rearWheel: [136, 184, 30],
    frontWheel: [316, 182, 33],
    farWheel: [434, 180, 14],
    headlight: "M384 130 L422 126 Q430 128 428 138 L388 144 Z",
    farHeadlight: "M434 126 L446 128 L446 136 L436 136 Z",
    grille: "M394 150 L432 146 L434 160 L396 164 Z",
    taillight: "M82 112 L94 104 L96 132 L84 138 Z",
    mirror: "M296 98 L314 96 L316 108 L300 108 Z",
    sill: "M136 186 L316 184 L326 190 L134 192 Z",
  },
  SUV: {
    side: "M60 182 L54 160 Q50 118 62 104 L92 94 C110 70 130 56 168 52 L270 50 C292 52 312 66 330 88 L372 98 Q388 102 392 118 L394 172 L364 182 C362 152 342 132 318 132 C292 132 274 152 272 180 L168 184 C166 156 146 138 122 138 C98 138 80 156 78 182 Z",
    face: "M372 98 L448 106 Q458 110 460 124 L460 166 L434 178 L394 182 L392 118 Q388 102 372 98 Z",
    hood: "M330 88 L372 98 L448 106 L404 85 L344 82 Z",
    roof: "M168 52 L270 50 L296 47 L198 48 Z",
    glass: "M98 100 C116 76 136 62 170 58 L266 57 C284 59 302 72 316 90 Z",
    windshield: "M270 50 L296 47 L404 85 L344 82 C328 68 300 52 270 50 Z",
    pillar: 222,
    pillar2: 132,
    belt: 106,
    doors: "M222 98 L220 178 M134 98 L140 170 M326 92 L328 132",
    rearWheel: [122, 186, 34],
    frontWheel: [318, 184, 37],
    farWheel: [444, 182, 15],
    headlight: "M396 118 L432 114 Q440 116 438 126 L398 132 Z",
    farHeadlight: "M444 112 L456 114 L456 124 L446 124 Z",
    grille: "M402 134 L444 130 L446 152 L404 156 Z",
    taillight: "M56 112 L76 106 L78 126 L58 132 Z",
    mirror: "M304 86 L324 84 L326 98 L308 98 Z",
    sill: "M122 182 L318 180 L330 188 L120 190 Z",
    rugged: true,
  },
  MPV: {
    side: "M54 184 L48 162 Q44 112 56 96 L76 84 C90 66 108 54 142 50 L282 48 C304 50 318 62 334 82 L374 96 Q390 100 394 116 L396 174 L366 184 C364 154 344 134 320 134 C294 134 276 154 274 182 L168 186 C166 158 146 140 122 140 C98 140 80 158 78 184 Z",
    face: "M374 96 L450 104 Q460 108 462 122 L462 168 L436 180 L396 184 L394 116 Q390 100 374 96 Z",
    hood: "M334 82 L374 96 L450 104 L408 79 L348 76 Z",
    roof: "M142 50 L282 48 L306 45 L170 46 Z",
    glass: "M72 94 C88 74 108 60 144 56 L278 55 C296 57 310 68 322 84 Z",
    windshield: "M282 48 L306 45 L408 79 L348 76 C334 64 310 50 282 48 Z",
    pillar: 248,
    pillar2: 160,
    belt: 102,
    doors: "M248 94 L246 180 M160 94 L162 182 M330 88 L332 134",
    rearWheel: [122, 182, 33],
    frontWheel: [320, 180, 36],
    farWheel: [446, 176, 16],
    headlight: "M398 116 L434 112 Q442 114 440 124 L400 130 Z",
    farHeadlight: "M446 110 L458 112 L458 122 L448 122 Z",
    grille: "M404 132 L446 128 L448 150 L406 154 Z",
    taillight: "M50 104 L68 98 L70 120 L52 126 Z",
    mirror: "M310 82 L330 80 L332 94 L314 94 Z",
    sill: "M122 184 L320 182 L332 190 L120 192 Z",
  },
};

function wheel(id: string, [cx, cy, r]: [number, number, number], squash: number, spokes = 5): string {
  const rx = r * squash;
  const rimRx = rx * 0.62;
  const rimRy = r * 0.62;
  let s = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${r}" fill="#16181b"/>`;
  s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.9}" ry="${r * 0.9}" fill="none" stroke="#2b2f34" stroke-width="2"/>`;
  s += `<ellipse cx="${cx}" cy="${cy}" rx="${rimRx}" ry="${rimRy}" fill="url(#${id}-rim)"/>`;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * rimRx * 0.92;
    const y = cy + Math.sin(a) * rimRy * 0.92;
    s += `<path d="M${cx} ${cy} L${x.toFixed(1)} ${y.toFixed(1)}" stroke="#9aa1a8" stroke-width="${(r * 0.16).toFixed(1)}" stroke-linecap="round"/>`;
    const a2 = a + Math.PI / spokes;
    const x2 = cx + Math.cos(a2) * rimRx * 0.78;
    const y2 = cy + Math.sin(a2) * rimRy * 0.78;
    s += `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="${(r * 0.08).toFixed(1)}" fill="#3a3f45"/>`;
  }
  s += `<ellipse cx="${cx}" cy="${cy}" rx="${rimRx * 0.24}" ry="${rimRy * 0.24}" fill="#cfd4d9" stroke="#6d747b" stroke-width="1"/>`;
  return s;
}

/**
 * SVG markup for one car. `uid` must be unique on the page (gradient ids).
 * Safe to inline: every input is an enum or a validated hex.
 */
export function carSvg(body: BodyType, paintHex: string, uid: string, opts: { shadow?: boolean; title?: string } = {}): string {
  const g = GEO[body];
  const base = /^#[0-9a-f]{6}$/i.test(paintHex) ? paintHex : PAINTS.SILVER.hex;
  const L = luminance(base);
  const light = mix(base, "#ffffff", L > 0.75 ? 0.55 : 0.32);
  const mid = base;
  const deep = mix(base, "#000000", L < 0.2 ? 0.35 : 0.42);
  const faceTop = mix(base, "#000000", L > 0.6 ? 0.08 : 0.14);
  const faceBot = mix(base, "#000000", L > 0.6 ? 0.3 : 0.45);
  const line = mix(base, "#000000", L > 0.6 ? 0.28 : 0.5);
  const id = uid.replace(/[^a-zA-Z0-9_-]/g, "");
  const title = opts.title ? `<title>${opts.title.replace(/[<>&"]/g, "")}</title>` : "";
  const shadow = opts.shadow === false ? "" : `<ellipse cx="258" cy="${Math.max(g.rearWheel[1] + g.rearWheel[2], g.frontWheel[1] + g.frontWheel[2]) + 2}" rx="218" ry="13" fill="#000" opacity="0.22" filter="url(#${id}-blur)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 250" role="img">${title}
<defs>
  <linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${light}"/>
    <stop offset="0.38" stop-color="${mid}"/>
    <stop offset="0.62" stop-color="${mid}"/>
    <stop offset="1" stop-color="${deep}"/>
  </linearGradient>
  <linearGradient id="${id}-face" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${faceTop}"/>
    <stop offset="1" stop-color="${faceBot}"/>
  </linearGradient>
  <linearGradient id="${id}-hood" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${mix(base, "#ffffff", 0.45)}"/>
    <stop offset="1" stop-color="${mix(base, "#ffffff", 0.15)}"/>
  </linearGradient>
  <linearGradient id="${id}-glass" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#5d7488"/>
    <stop offset="0.55" stop-color="#22303c"/>
    <stop offset="1" stop-color="#121a22"/>
  </linearGradient>
  <linearGradient id="${id}-ws" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8aa3b7"/>
    <stop offset="0.5" stop-color="#2c3d4c"/>
    <stop offset="1" stop-color="#131b23"/>
  </linearGradient>
  <linearGradient id="${id}-sheen" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/>
    <stop offset="0.45" stop-color="#fff" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="${id}-rim" cx="0.4" cy="0.35" r="0.75">
    <stop offset="0" stop-color="#f4f6f8"/>
    <stop offset="0.6" stop-color="#b8bec5"/>
    <stop offset="1" stop-color="#6f767e"/>
  </radialGradient>
  <linearGradient id="${id}-lamp" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="1" stop-color="#b9c6d2"/>
  </linearGradient>
  <clipPath id="${id}-gclip"><path d="${g.glass}"/></clipPath>
  <filter id="${id}-blur" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="6"/></filter>
</defs>
${shadow}
<!-- far wheel: just the tyre, peeking under the nose -->
<ellipse cx="${g.farWheel[0]}" cy="${g.farWheel[1]}" rx="${g.farWheel[2] * 0.55}" ry="${g.farWheel[2]}" fill="#121417"/>
<!-- wheel wells, dark behind the arch cut-outs -->
<ellipse cx="${g.rearWheel[0]}" cy="${g.rearWheel[1] - 1}" rx="${g.rearWheel[2] + 13}" ry="${g.rearWheel[2] + 10}" fill="#0c0e10"/>
<ellipse cx="${g.frontWheel[0]}" cy="${g.frontWheel[1] - 1}" rx="${g.frontWheel[2] + 13}" ry="${g.frontWheel[2] + 10}" fill="#0c0e10"/>
<rect x="40" y="${Math.max(g.rearWheel[1], g.frontWheel[1]) + 4}" width="420" height="60" fill="#fff" opacity="0"/>
<!-- body -->
<path d="${g.side}" fill="url(#${id}-body)"/>
<path d="${g.face}" fill="url(#${id}-face)"/>
<path d="${g.hood}" fill="url(#${id}-hood)"/>
<path d="${g.roof}" fill="${mix(base, "#ffffff", 0.35)}"/>
<!-- glass -->
<path d="${g.windshield}" fill="url(#${id}-ws)"/>
<path d="${g.glass}" fill="url(#${id}-glass)"/>
<g clip-path="url(#${id}-gclip)">
  <path d="M${g.pillar + 2} ${g.belt - 70} L${g.pillar - 4} ${g.belt + 4}" stroke="${deep}" stroke-width="8"/>
  ${g.pillar2 ? `<path d="M${g.pillar2 + 4} ${g.belt - 70} L${g.pillar2 - 6} ${g.belt + 4}" stroke="${deep}" stroke-width="7"/>` : ""}
  <path d="M60 ${g.belt - 40} L400 ${g.belt - 60} L400 ${g.belt - 48} L60 ${g.belt - 26} Z" fill="#ffffff" opacity="0.13"/>
</g>
<path d="${g.glass}" fill="none" stroke="${deep}" stroke-width="3" stroke-linejoin="round"/>
<path d="${g.windshield}" fill="none" stroke="${mix(base, "#000000", 0.2)}" stroke-width="3.5" stroke-linejoin="round"/>
${g.rugged ? `<path d="${g.roof}" fill="none" stroke="#1b1e22" stroke-width="2.5" transform="translate(0 -3)"/>` : ""}
<!-- shoulder highlight + panel lines -->
<path d="M70 ${g.belt + 2} L380 ${g.belt + 8}" stroke="url(#${id}-sheen)" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
<path d="${g.doors}" stroke="${line}" stroke-width="1.4" fill="none" opacity="0.7"/>
<rect x="${g.pillar - 30}" y="${g.belt + 12}" width="16" height="4" rx="2" fill="${line}" opacity="0.8"/>
<rect x="${g.pillar + 34}" y="${g.belt + 12}" width="16" height="4" rx="2" fill="${line}" opacity="0.8"/>
<path d="${g.sill}" fill="#000" opacity="${g.rugged ? 0.55 : 0.18}"/>
${g.rugged ? [g.rearWheel, g.frontWheel].map(([cx, cy, r]) => `<path d="M${cx - r * 0.78 - 9} ${cy + 2} A ${r * 0.78 + 9} ${r + 9} 0 0 1 ${cx + r * 0.78 + 9} ${cy + 2}" fill="none" stroke="#1d2024" stroke-width="7"/>`).join("") : ""}
<!-- nose details -->
<path d="${g.grille}" fill="#15191d" stroke="#3b4148" stroke-width="1.5"/>
<path d="${g.headlight}" fill="url(#${id}-lamp)" stroke="${line}" stroke-width="1"/>
<path d="${g.farHeadlight}" fill="url(#${id}-lamp)" opacity="0.85"/>
<path d="${g.taillight}" fill="#a3141c" stroke="#5e0a0f" stroke-width="1"/>
<path d="${g.mirror}" fill="${mid}" stroke="${line}" stroke-width="1"/>
<!-- wheels -->
${wheel(id, g.rearWheel, 0.78)}
${wheel(id, g.frontWheel, 0.8)}
</svg>`;
}
