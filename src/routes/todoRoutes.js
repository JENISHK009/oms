import express from 'express';
import { todoController } from '../controller/index.js';
const router = express.Router();

router.post('/createTask', todoController.createTask);
router.get('/getTasks', todoController.getTasks);

export default router;
