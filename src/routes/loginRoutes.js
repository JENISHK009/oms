import express from 'express';
import { loginContoller } from '../controller/index.js';
const router = express.Router();

router.post('/', loginContoller.login);

export default router;
