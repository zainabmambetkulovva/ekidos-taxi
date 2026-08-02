"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const supabase_1 = require("../lib/supabase");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
// Multer config - memory storage for Supabase, disk fallback
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|webp/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only images and PDF files are allowed'));
    },
});
// Upload file — uses Supabase Storage, falls back to local disk
router.post('/', auth_middleware_1.authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const ext = path_1.default.extname(req.file.originalname);
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        const storagePath = `uploads/${fileName}`;
        // Try Supabase Storage first
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const publicUrl = await (0, supabase_1.uploadToStorage)('ekidos-taxi', storagePath, req.file.buffer, req.file.mimetype);
            if (publicUrl) {
                return res.json({ url: publicUrl, fileName, storage: 'supabase' });
            }
        }
        // Fallback: save to local disk
        const localPath = path_1.default.join(uploadsDir, fileName);
        fs_1.default.writeFileSync(localPath, req.file.buffer);
        return res.json({ url: `/uploads/${fileName}`, fileName, storage: 'local' });
    }
    catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: 'Upload failed' });
    }
});
// Upload multiple files
router.post('/multiple', auth_middleware_1.authenticateToken, upload.array('files', 10), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        const results = [];
        for (const file of files) {
            const ext = path_1.default.extname(file.originalname);
            const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
            const storagePath = `uploads/${fileName}`;
            if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
                const publicUrl = await (0, supabase_1.uploadToStorage)('ekidos-taxi', storagePath, file.buffer, file.mimetype);
                if (publicUrl) {
                    results.push({ url: publicUrl, fileName, originalName: file.originalname });
                    continue;
                }
            }
            // Fallback local
            const localPath = path_1.default.join(uploadsDir, fileName);
            fs_1.default.writeFileSync(localPath, file.buffer);
            results.push({ url: `/uploads/${fileName}`, fileName, originalName: file.originalname });
        }
        return res.json({ files: results });
    }
    catch (error) {
        return res.status(500).json({ error: 'Upload failed' });
    }
});
exports.default = router;
