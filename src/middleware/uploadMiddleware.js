import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();

const checkFileType = (file, cb) => {
  const filetypes = /jpeg|jpg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) return cb(null, true);

  const err = new Error("Images only (jpeg/jpg/png/webp)");
  err.status = 400;
  return cb(err);
};

/**
 * Build a multer instance.
 * Note: `limits.files` must match the route usage:
 * - single() needs files: 1
 * - fields(front/back) needs files: 2
 */
const makeUpload = ({ fileSizeMB, filesLimit, allowedFields = null }) =>
  multer({
    storage,
    limits: {
      fileSize: fileSizeMB * 1024 * 1024,
      files: filesLimit,
    },
    fileFilter: (req, file, cb) => {
      // Optional: enforce allowed field names
      if (Array.isArray(allowedFields) && allowedFields.length > 0) {
        if (!allowedFields.includes(file.fieldname)) {
          const err = new Error(`Invalid field "${file.fieldname}"`);
          err.status = 400;
          return cb(err);
        }
      }
      return checkFileType(file, cb);
    },
  });

/**
 * ✅ Default uploader (5MB, 1 file)
 * Used for:
 * - upload.single("image") in products
 * - upload.single("avatar") in profile
 * - upload.single("image") in admin upload-image
 */
export const upload = makeUpload({
  fileSizeMB: 5,
  filesLimit: 1,
});

/**
 * ✅ OCR uploader (10MB per file, 2 files max: front/back)
 * Used for:
 * - uploadOCR.fields([{name:"front"},{name:"back"}])
 */
export const uploadOCR = makeUpload({
  fileSizeMB: 10,
  filesLimit: 2,
  allowedFields: ["front", "back"],
});

export default upload;