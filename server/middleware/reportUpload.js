const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { randomUUID } = require('crypto');

const uploadDirectory = path.resolve(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploadDirectory),
  filename: (req, file, callback) => {
    const extension = allowedTypes.get(file.mimetype);
    callback(null, `${randomUUID()}${extension}`);
  },
});

const uploadReportImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const expectedExtension = allowedTypes.get(file.mimetype);
    const actualExtension = path.extname(file.originalname).toLowerCase();
    if (!expectedExtension || expectedExtension !== actualExtension) {
      const error = new Error('Upload a JPG, PNG, or WebP image.');
      error.code = 'UPLOAD_INVALID_TYPE';
      return callback(error);
    }
    return callback(null, true);
  },
}).single('image');

module.exports = { uploadReportImage, uploadDirectory };
