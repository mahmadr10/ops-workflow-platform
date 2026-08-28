import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Local-disk attachment storage. Real files, not just metadata: uploads land in
 * `backend/uploads/`, served back at `/uploads/<filename>`, and every write goes through
 * multer's size/type limits. Swapping this for S3/MinIO later only means changing this one file
 * (write to the bucket instead of disk, return the bucket URL) - nothing else in the app cares
 * where the bytes physically live.
 *
 * Note: on ephemeral hosts (Railway/Render free tiers) the local disk does not persist across
 * redeploys. Fine for a demo; production would point this at S3/MinIO instead.
 */

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).slice(0, 20);
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});

export { uploadDir };
