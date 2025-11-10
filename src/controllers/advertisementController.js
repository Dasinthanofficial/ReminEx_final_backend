import Advertisement from "../models/Advertisement.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Helper function to delete old image files
const deleteImageFile = (imagePath) => {
  if (!imagePath) return;
  
  try {
    const fullPath = path.join(__dirname, "..", imagePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`🗑️  Deleted old image: ${imagePath}`);
    }
  } catch (err) {
    console.error("Error deleting image:", err);
  }
};

// ✅ Add Advertisement
export const addAdvertisement = async (req, res) => {
  try {
    const { title, description, link } = req.body;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const image = req.file.path;

    const ad = await Advertisement.create({ 
      title, 
      description, 
      link, 
      image 
    });
    
    console.log(`✅ Advertisement created: ${title}`);
    res.status(201).json({ 
      message: "Advertisement added successfully", 
      ad 
    });
  } catch (err) {
    console.error("Error adding advertisement:", err);
    
    // ✅ Clean up uploaded file if database save fails
    if (req.file) {
      deleteImageFile(req.file.path);
    }
    
    res.status(500).json({ message: err.message });
  }
};

// ✅ Get all Advertisements
export const getAdvertisements = async (req, res) => {
  try {
    const ads = await Advertisement.find().sort({ createdAt: -1 });
    res.json(ads);
  } catch (err) {
    console.error("Error fetching advertisements:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Update Advertisement
export const updateAdvertisement = async (req, res) => {
  try {
    const ad = await Advertisement.findById(req.params.id);
    
    if (!ad) {
      // ✅ Clean up uploaded file if ad doesn't exist
      if (req.file) {
        deleteImageFile(req.file.path);
      }
      return res.status(404).json({ message: "Advertisement not found" });
    }

    const oldImage = ad.image;

    // ✅ Update image if new file uploaded
    if (req.file) {
      ad.image = req.file.path;
    }

    // ✅ Update other fields
    if (req.body.title) ad.title = req.body.title;
    if (req.body.description) ad.description = req.body.description;
    if (req.body.link) ad.link = req.body.link;

    await ad.save();

    // ✅ Delete old image only after successful save
    if (req.file && oldImage) {
      deleteImageFile(oldImage);
    }

    console.log(`✅ Advertisement updated: ${ad.title}`);
    res.json({ 
      message: "Advertisement updated successfully", 
      ad 
    });
  } catch (err) {
    console.error("Error updating advertisement:", err);
    
    // ✅ Clean up uploaded file if update fails
    if (req.file) {
      deleteImageFile(req.file.path);
    }
    
    res.status(500).json({ message: err.message });
  }
};

// ✅ Delete Advertisement
export const deleteAdvertisement = async (req, res) => {
  try {
    const ad = await Advertisement.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({ message: "Advertisement not found" });
    }

    const imagePath = ad.image;

    // ✅ Delete from database
    await Advertisement.findByIdAndDelete(req.params.id);

    // ✅ Delete associated image file
    if (imagePath) {
      deleteImageFile(imagePath);
    }

    console.log(`✅ Advertisement deleted: ${ad.title}`);
    res.json({ message: "Advertisement deleted successfully" });
  } catch (err) {
    console.error("Error deleting advertisement:", err);
    res.status(500).json({ message: err.message });
  }
};