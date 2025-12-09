import multer from "multer";
import path from "path";

// ------------------------------------------------------------------
// Multer storage configuration: MEMORY storage (no disk/uploads folder)
// ------------------------------------------------------------------
const storage = multer.memoryStorage();

// ------------------------------------------------------------------
// File‑type filter (allow only common image types)
// ------------------------------------------------------------------
const checkFileType = (file, cb) => {
  const filetypes = /jpeg|jpg|png|webp/;
  const extname = filetypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = filetypes.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error("Error: Images Only!"));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => checkFileType(file, cb),
});

export default upload;