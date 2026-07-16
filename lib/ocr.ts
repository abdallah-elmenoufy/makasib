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

/** Draw to canvas, downscale huge images, auto-invert dark screenshots.
 *  `boost` adds grayscale + contrast stretch (helps dashboard odometers). */
async function toCanvas(file: File | Blob, boost = false): Promise<HTMLCanvasElement> {
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
    let lum = 0;
    const step = 40 * 4;
    let n = 0;
    for (let i = 0; i < px.length; i += step) {
      lum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      n++;
    }
    const dark = lum / n < 110;
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

/** Full-text OCR of an app screenshot. */
export async function ocrScreenshot(file: File | Blob): Promise<string> {
  const worker = await getWorker();
  await worker.setParameters({ tessedit_char_whitelist: "" });
  const canvas = await toCanvas(file);
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
