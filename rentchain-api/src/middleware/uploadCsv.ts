import multer from "multer";

const maxBytes = Number(process.env.CSV_UPLOAD_MAX_BYTES || 5 * 1024 * 1024);
const allowed = String(
  process.env.CSV_UPLOAD_ALLOWED_MIME || "text/csv,application/vnd.ms-excel"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function fileFilter(_req: any, file: Express.Multer.File, cb: any) {
  const byMime = allowed.includes(file.mimetype);
  const byExt = file.originalname?.toLowerCase().endsWith(".csv");
  if (byMime || byExt) return cb(null, true);
  return cb(new Error(`Invalid file type: ${file.mimetype}`));
}

export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes },
  fileFilter,
});
