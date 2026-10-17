const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const uploadDirectory = path.resolve(
  __dirname,
  "..",
  "uploads",
  "videos"
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDirectory);
    },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    cb(null, `${uuidv4()}${extension}`);
  },
});

const allowedTypes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/mpeg",
];

const fileFilter = (req, file, cb) => {
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error(
        "Unsupported video format. Allowed formats: MP4, WebM, MOV, MPEG.",
      ),
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 49 * 1024 * 1024,
    files: 1,
  },
});

module.exports = upload;
