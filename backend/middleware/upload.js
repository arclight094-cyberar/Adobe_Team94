import { cloudinary } from '../config/cloudinary.js';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temporary directory for downloaded images (used only during AI operations)
const tempImageDir = path.join(__dirname, '..', 'image', 'temp');
fs.mkdir(tempImageDir, { recursive: true }).catch(console.error);

// Custom storage that saves ONLY to Cloudinary (no local filesystem)
class CloudinaryOnlyStorage extends CloudinaryStorage {
    async _handleFile(req, file, cb) {
        // Collect file chunks to upload to Cloudinary
        const chunks = [];
        let totalBytes = 0;

        file.stream.on('data', (chunk) => {
            chunks.push(chunk);
            totalBytes += chunk.length;
        });

        file.stream.on('end', async () => {
            try {
                const buffer = Buffer.concat(chunks);

                // Create a new readable stream from buffer for Cloudinary
                const bufferStream = new Readable();
                bufferStream.push(buffer);
                bufferStream.push(null);

                // Create a file-like object for Cloudinary upload
                const cloudinaryFile = {
                    ...file,
                    buffer: buffer,
                    stream: bufferStream,
                    size: totalBytes
                };

                // Extract image dimensions from buffer as fallback
                let imageWidth = 0;
                let imageHeight = 0;
                try {
                    const metadata = await sharp(buffer).metadata();
                    imageWidth = metadata.width || 0;
                    imageHeight = metadata.height || 0;
                } catch (dimErr) {
                    console.warn('Could not extract image dimensions:', dimErr.message);
                }

                // Upload to Cloudinary using parent class
                super._handleFile(req, cloudinaryFile, (err, cloudinaryResult) => {
                    if (err) {
                        return cb(err);
                    }

                    // Extract format from filename if not in Cloudinary result
                    const fileExt = path.extname(file.originalname || '').slice(1).toLowerCase() || 'jpg';
                    const format = cloudinaryResult.format || 
                                   (fileExt === 'jpg' ? 'jpeg' : fileExt) || 
                                   'jpg';

                    // Ensure all required properties are present
                    // CloudinaryStorage normally provides: filename, path, format, width, height, bytes
                    const result = {
                        ...cloudinaryResult,
                        localPath: null, // No local path - images are only in Cloudinary
                        // Ensure format is set
                        format: format,
                        // Use Cloudinary dimensions if available, otherwise use extracted dimensions
                        width: cloudinaryResult.width || imageWidth,
                        height: cloudinaryResult.height || imageHeight,
                        // Ensure size/bytes is set
                        bytes: cloudinaryResult.bytes || totalBytes,
                        size: cloudinaryResult.bytes || totalBytes
                    };

                    cb(null, result);
                });
            } catch (err) {
                console.error('Error processing file:', err);
                return cb(err);
            }
        });

        file.stream.on('error', (err) => {
            cb(err);
        });
    }
}

// Configure Cloudinary-only storage (no local filesystem)
const storage = new CloudinaryOnlyStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'adobe-ps-uploads', // Folder name in Cloudinary
        allowed_formats: ['jpg', 'jpeg', 'png', 'heif'],
        // No transformation - preserve original dimensions for AI processing
    }
});

// Create multer upload middleware
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB max file size
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

export default upload;
