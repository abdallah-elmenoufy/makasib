// Tiny OCR CLI over Apple's Vision framework — reads text (incl. 7-segment
// dashboard LCDs that tesseract can't) from an image file. Phase-1 only:
// the server runs on macOS; the native mobile app will use Vision/ML Kit
// directly. Compiled on first use by /api/ocr (see route.ts).
import Foundation
import Vision

guard CommandLine.arguments.count > 1 else {
    FileHandle.standardError.write("usage: vision-ocr <image>\n".data(using: .utf8)!)
    exit(2)
}
let url = URL(fileURLWithPath: CommandLine.arguments[1])

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false

let handler = VNImageRequestHandler(url: url, options: [:])
do {
    try handler.perform([request])
} catch {
    FileHandle.standardError.write("vision failed: \(error)\n".data(using: .utf8)!)
    exit(1)
}
for obs in request.results ?? [] {
    if let best = obs.topCandidates(1).first {
        print(best.string)
    }
}
