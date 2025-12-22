// import multer from "multer";
// import path from "path";


// const storage = multer.memoryStorage();


// const checkFileType = (file, cb) => {
//   const filetypes = /jpeg|jpg|png|webp/;
//   const extname = filetypes.test(
//     path.extname(file.originalname).toLowerCase()
//   );
//   const mimetype = filetypes.test(file.mimetype);
//   if (extname && mimetype) return cb(null, true);
//   cb(new Error("Error: Images Only!"));
// };

// const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
//   fileFilter: (req, file, cb) => checkFileType(file, cb),
// });

// export default upload;


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

const makeUpload = ({ fileSizeMB }) =>
  multer({
    storage,
    limits: {
      fileSize: fileSizeMB * 1024 * 1024,
      files: 2, // front + back max
    },
    fileFilter: (req, file, cb) => checkFileType(file, cb),
  });

// ✅ default (keep strict to avoid RAM spikes)
export const upload = makeUpload({ fileSizeMB: 5 });

// ✅ OCR can be slightly bigger (but beware: memoryStorage uses RAM)
export const uploadOCR = makeUpload({ fileSizeMB: 10 });

export default upload;