import express from 'express';
import { storeCategoriesController } from '../controller/index.js';

const router = express.Router();

router.get(
  '/getAllStoreCategories',
  storeCategoriesController.getAllStoreCategories
);

export default router;
