// Generates the in-store QR code (section 45) pointing to the Lucky Spin site.
//   npm run qr   -> docs/marketing/qr-quay-hussio-vn.svg + .png
import { mkdirSync } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";

const URL_TARGET = process.argv[2] ?? "https://quay.hussio-vn.com";
const outDir = path.resolve("docs", "marketing");

async function main() {
  mkdirSync(outDir, { recursive: true });
  const options = { errorCorrectionLevel: "H" as const, margin: 2, color: { dark: "#0A1628", light: "#FFFFFF" } };
  await QRCode.toFile(path.join(outDir, "qr-quay-hussio-vn.svg"), URL_TARGET, { ...options, type: "svg" });
  await QRCode.toFile(path.join(outDir, "qr-quay-hussio-vn.png"), URL_TARGET, { ...options, type: "png", width: 1200 });
  console.log(`✔ QR for ${URL_TARGET} written to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
