import express from 'express';
import { storeContoller } from '../controller/index.js';

const router = express.Router();

router.get('/getAllStores', storeContoller.getAllStores);

export default router;
