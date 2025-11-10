import express from "express";
import multer from "multer";
import path from "path";
import {
  addAdvertisement,
  getAdvertisements,
  updateAdvertisement,
  deleteAdvertisement,
} from "../controllers/advertisementController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { validateAdvertisement, validateMongoId } from "../middleware/validators.js";

const router = express.Router();

// ✅ Multer setup with SECURITY
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase();
    const uniqueName = Date.now() + "-" + safeName;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP images are allowed.'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  }
});

// ✅ Middleware to handle Multer errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File too large. Maximum size allowed is 5MB.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        message: 'Too many files. Only one image allowed.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: 'Unexpected field name. Use "image" as the field name.'
      });
    }
    return res.status(400).json({ message: err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// ✅ Public route - anyone can view ads
router.get("/", getAdvertisements);

// ✅ Admin routes with file upload security and validation
router.post(
  "/",
  protect,
  adminOnly,
  upload.single("image"),
  handleUploadError,
  validateAdvertisement,
  addAdvertisement
);

router.put(
  "/:id",
  protect,
  adminOnly,
  validateMongoId,
  upload.single("image"),
  handleUploadError,
  validateAdvertisement,
  updateAdvertisement
);

router.delete(
  "/:id",
  protect,
  adminOnly,
  validateMongoId,
  deleteAdvertisement
);

export default router;