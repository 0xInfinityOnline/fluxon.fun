import { Router } from 'express';
import multer from 'multer';
import { processCSV, resetUserData, listUploads, deleteUpload, getUploadPreview } from '../controllers/csv.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/upload', authMiddleware, upload.single('file'), processCSV);
router.delete('/reset', authMiddleware, resetUserData);
router.get('/uploads', authMiddleware, listUploads);
router.delete('/uploads/:id', authMiddleware, deleteUpload);
router.get('/uploads/:id/preview', authMiddleware, getUploadPreview);

export { router };
