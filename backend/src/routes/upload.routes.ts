import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.middleware';
import { uploadToStorage } from '../lib/supabase';
import path from 'path';
import fs from 'fs';

const router = Router();

// Multer config - memory storage for Supabase, disk fallback
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images and PDF files are allowed'));
  },
});

// Upload file — uses Supabase Storage, falls back to local disk
router.post('/', authenticateToken, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const storagePath = `uploads/${fileName}`;

    // Try Supabase Storage first
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const publicUrl = await uploadToStorage(
        'ekidos-taxi',
        storagePath,
        req.file.buffer,
        req.file.mimetype
      );

      if (publicUrl) {
        return res.json({ url: publicUrl, fileName, storage: 'supabase' });
      }
    }

    // Fallback: save to local disk
    const localPath = path.join(uploadsDir, fileName);
    fs.writeFileSync(localPath, req.file.buffer);
    return res.json({ url: `/uploads/${fileName}`, fileName, storage: 'local' });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

// Upload multiple files
router.post('/multiple', authenticateToken, upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    for (const file of files) {
      const ext = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const storagePath = `uploads/${fileName}`;

      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const publicUrl = await uploadToStorage('ekidos-taxi', storagePath, file.buffer, file.mimetype);
        if (publicUrl) {
          results.push({ url: publicUrl, fileName, originalName: file.originalname });
          continue;
        }
      }

      // Fallback local
      const localPath = path.join(uploadsDir, fileName);
      fs.writeFileSync(localPath, file.buffer);
      results.push({ url: `/uploads/${fileName}`, fileName, originalName: file.originalname });
    }

    return res.json({ files: results });
  } catch (error) {
    return res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
