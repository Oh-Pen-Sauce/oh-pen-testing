// Should flag: multer() without fileFilter.
import multer from "multer";
export const upload = multer({ dest: "/tmp/uploads", limits: { fileSize: 100_000_000 } });
