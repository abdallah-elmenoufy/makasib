// Client-side OCR helpers built on tesseract.js (loaded lazily — the model
// files download on first use). Only import from client components.

let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker }) => createWorker("eng"));
  }
  return workerPromise;
}

/** Draw to canvas, downscale huge images, auto-invert dark screenshots. */
async function toCanvas(file: File | Blob): Promise<HTMLCanvasElement> {
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
    if (lum / n < 110) {
      // dark-theme screenshot → invert for OCR
      for (let i = 0; i < px.length; i += 4) {
        px[i] = 255 - px[i];
        px[i + 1] = 255 - px[i + 1];
        px[i + 2] = 255 - px[i + 2];
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

/**
 * Digits-only OCR for odometer photos. Returns candidate readings
 * (4–7 digit runs), longest first — the caller picks the plausible one.
 */
export async function ocrOdometerCandidates(file: File | Blob): Promise<number[]> {
  const worker = await getWorker();
  await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
  const canvas = await toCanvas(file);
  const {
    data: { text },
  } = await worker.recognize(canvas);
  await worker.setParameters({ tessedit_char_whitelist: "" });

  const runs: string[] = text.match(/\d{4,7}/g) ?? [];
  const unique: number[] = [...new Set(runs.map((r) => Number(r)))];
  return unique.sort((a, b) => String(b).length - String(a).length);
}
