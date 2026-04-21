// Must NOT flag: multer() with fileFilter set.
import multer from "multer";
const ALLOWED = ["image/png", "image/jpeg"];
export const upload = multer({
  dest: "/tmp/uploads",
  limits: { fileSize: 5_000_000 },
  fileFilter(_req, file, cb) {
    cb(null, ALLOWED.includes(file.mimetype));
  },
});
