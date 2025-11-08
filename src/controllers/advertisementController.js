import Advertisement from "../models/Advertisement.js";

// Add Advertisement
export const addAdvertisement = async (req, res) => {
  try {
    const { title, description, link } = req.body;
    const image = req.file ? req.file.path : null;

    if (!image) return res.status(400).json({ message: "Image is required" });

    const ad = await Advertisement.create({ title, description, link, image });
    res.status(201).json({ message: "Advertisement added", ad });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all Ads
export const getAdvertisements = async (req, res) => {
  try {
    const ads = await Advertisement.find().sort({ createdAt: -1 });
    res.json(ads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update Advertisement
export const updateAdvertisement = async (req, res) => {
  try {
    const ad = await Advertisement.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: "Advertisement not found" });

    if (req.file) ad.image = req.file.path; // update image if uploaded
    Object.assign(ad, req.body);
    await ad.save();

    res.json({ message: "Advertisement updated", ad });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete Advertisement
export const deleteAdvertisement = async (req, res) => {
  try {
    const ad = await Advertisement.findByIdAndDelete(req.params.id);
    if (!ad) return res.status(404).json({ message: "Advertisement not found" });

    res.json({ message: "Advertisement deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
