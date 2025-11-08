import express from "express";
import multer from "multer";
import {
  addAdvertisement,
  getAdvertisements,
  updateAdvertisement,
  deleteAdvertisement,
} from "../controllers/advertisementController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // folder to save images
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Public route
router.get("/", getAdvertisements);

// Admin routes
router.post("/", protect, adminOnly, upload.single("image"), addAdvertisement);
router.put("/:id", protect, adminOnly, upload.single("image"), updateAdvertisement);
router.delete("/:id", protect, adminOnly, deleteAdvertisement);

export default router;
