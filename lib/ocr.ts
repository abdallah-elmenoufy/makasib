// Client-side OCR helpers built on tesseract.js (loaded lazily — the model
// files download on first use). Only import from client components.

/**
 * Server-side Apple Vision OCR of an already-uploaded file — far better on
 * 7-segment dashboard LCDs than tesseract. Returns digit-run candidates,
 * or null when the server can't do it (no macOS/Swift) → caller falls back.
 */
export async function serverOdometerCandidates(filename: string): Promise<number[] | null> {
  try {
    const res = await fetch(`/api/ocr/${encodeURIComponent(filename)}`);
    if (!res.ok) return null;
    const { lines } = (await res.json()) as { lines: string[] };
    const found = new Set<number>();
    for (const line of lines) {
      for (const run of line.replace(/[.,\s]/g, "").match(/\d{4,7}/g) ?? []) {
        found.add(Number(run));
      }
    }
    return [...found].sort((a, b) => String(b).length - String(a).length);
  } catch {
    return null;
  }
}

let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker }) => createWorker("eng"));
  }
  return workerPromise;
}

/** Kick off the tesseract worker download/init ahead of time (fire-and-forget)
 *  so the first real OCR call — e.g. scoring an incoming offer under a
 *  countdown — doesn't pay the cold-start cost. Safe to call repeatedly. */
export function warmupOcr(): void {
  void getWorker();
}

/** Draw to canvas, downscale huge images, auto-invert dark screenshots.
 *  `boost` adds grayscale + contrast stretch (helps dashboard odometers).
 *  `forceInvert` skips detection and always inverts — a fallback retry for
 *  screenshots whose auto-detected polarity produced unreadable text. */
async function toCanvas(file: File | Blob, boost = false, forceInvert = false): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, 1800 / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    // bias the sample toward the bottom two-thirds of the frame: request
    // cards, earnings-activity cards, and receipt cards all dock at the
    // bottom over a lighter map/background — a whole-image average lets
    // that brighter top skew the reading and miss a dark card entirely
    const sampleFromRow = Math.floor(canvas.height * 0.33);
    const rowStride = canvas.width * 4;
    let lum = 0;
    const step = 40 * 4;
    let n = 0;
    for (let i = sampleFromRow * rowStride; i < px.length; i += step) {
      lum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      n++;
    }
    const dark = forceInvert || lum / n < 120;
    if (dark || boost) {
      let min = 255;
      let max = 0;
      if (boost) {
        for (let i = 0; i < px.length; i += step) {
          const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          if (g < min) min = g;
          if (g > max) max = g;
        }
        if (max - min < 20) {
          min = 0;
          max = 255;
        }
      }
      for (let i = 0; i < px.length; i += 4) {
        let r = px[i];
        let g = px[i + 1];
        let b = px[i + 2];
        if (dark) {
          r = 255 - r;
          g = 255 - g;
          b = 255 - b;
        }
        if (boost) {
          // grayscale + linear contrast stretch
          const v = Math.min(255, Math.max(0, ((0.299 * r + 0.587 * g + 0.114 * b) - min) * (255 / (max - min))));
          r = g = b = v;
        }
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
      }
      ctx.putImageData(data, 0, 0);
    }
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Full-text OCR of an app screenshot. `forceInvert` is a fallback retry
 *  for a screenshot whose auto-detected polarity produced unreadable text.
 *  Always contrast-boosted — small low-contrast UI text (status-bar clock,
 *  product-tag pills) sitting over a busy map background is otherwise
 *  frequently dropped entirely by tesseract, confirmed against real trip
 *  request screenshots where boosting recovered the product tag the
 *  unboosted pass missed completely. */
export async function ocrScreenshot(file: File | Blob, forceInvert = false): Promise<string> {
  const worker = await getWorker();
  await worker.setParameters({ tessedit_char_whitelist: "" });
  const canvas = await toCanvas(file, true, forceInvert);
  const {
    data: { text },
  } = await worker.recognize(canvas);
  return text;
}

function rotate(canvas: HTMLCanvasElement, deg: 90 | 180 | 270): HTMLCanvasElement {
  const out = document.createElement("canvas");
  const swap = deg !== 180;
  out.width = swap ? canvas.height : canvas.width;
  out.height = swap ? canvas.width : canvas.height;
  const ctx = out.getContext("2d")!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

/**
 * Digits-only OCR for odometer photos. Returns candidate readings
 * (4–7 digit runs), longest first — the caller picks the plausible one.
 * Tries all four rotations: dashboard photos are often taken sideways and
 * EXIF orientation may be lost in conversion.
 */
export async function ocrOdometerCandidates(file: File | Blob): Promise<number[]> {
  const worker = await getWorker();
  await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
  const base = await toCanvas(file, true);

  const found = new Set<number>();
  const variants: (HTMLCanvasElement | null)[] = [base, null, null, null];
  for (let v = 0; v < 4; v++) {
    if (v === 1) variants[1] = rotate(base, 90);
    if (v === 2) variants[2] = rotate(base, 270);
    if (v === 3) variants[3] = rotate(base, 180);
    const {
      data: { text },
    } = await worker.recognize(variants[v]!);
    for (const run of text.match(/\d{4,7}/g) ?? []) found.add(Number(run));
    // a 5+ digit run in an early orientation is almost certainly the reading
    if ([...found].some((n) => String(n).length >= 5)) break;
  }
  await worker.setParameters({ tessedit_char_whitelist: "" });

  return [...found].sort((a, b) => String(b).length - String(a).length);
}
