import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { Request, RequestHandler } from 'express';
import { createError } from './errorHandler';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
  if (ALLOWED_TYPES.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
}).single('avatar');

interface DetectedImage {
  extension: '.jpg' | '.png' | '.webp';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export const detectImageType = (buffer: Buffer): DetectedImage | null => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: '.jpg', mimeType: 'image/jpeg' };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: '.png', mimeType: 'image/png' };
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { extension: '.webp', mimeType: 'image/webp' };
  }
  return null;
};

const declaredMimeMatches = (declaredMime: string, detectedMime: DetectedImage['mimeType']): boolean =>
  detectedMime === 'image/jpeg'
    ? declaredMime === 'image/jpeg' || declaredMime === 'image/jpg'
    : declaredMime === detectedMime;

export const uploadAvatar: RequestHandler = (req, res, next): void => {
  parser(req, res, (error) => {
    if (error) {
      const message = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? 'Image must be 5 MB or smaller.'
        : 'Only JPEG, PNG, and WebP images are allowed.';
      next(createError(message, 400));
      return;
    }

    const file = req.file;
    if (!file) {
      next();
      return;
    }

    const detected = detectImageType(file.buffer);
    if (!detected || !declaredMimeMatches(file.mimetype.toLowerCase(), detected.mimeType)) {
      next(createError('Uploaded file content must match a JPEG, PNG, or WebP image.', 400));
      return;
    }

    const directory = path.join(process.cwd(), 'uploads', 'avatars');
    const filename = `avatar-${uuidv4()}${detected.extension}`;
    const filePath = path.join(directory, filename);

    void fs.mkdir(directory, { recursive: true })
      .then(() => fs.writeFile(filePath, file.buffer, { flag: 'wx', mode: 0o644 }))
      .then(() => {
        file.destination = directory;
        file.filename = filename;
        file.path = filePath;
        file.mimetype = detected.mimeType;
        next();
      })
      .catch(next);
  });
};
