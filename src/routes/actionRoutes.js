import express from 'express';
import { actionContoller } from '../controller/index.js';

const router = express.Router();

router.get('/getSellerActions', actionContoller.getSellerActions);

export default router;
