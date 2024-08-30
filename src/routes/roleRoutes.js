import express from 'express';
import { roleContoller } from '../controller/index.js';
import {
  decryptRequest,
  checkSellerRole,
  sellerAuthanticateJWT,
} from '../middleware/index.js';

const router = express.Router();

router.post('/createRole', roleContoller.createRole);

router.get('/getAllRoles', roleContoller.getAllRoles);

router.get('/getRole', roleContoller.getRole);

router.patch('/updateRole', roleContoller.updateRole);

router.delete('/deleteRole', roleContoller.deleteRole);

router.patch('/updateRoleStatus', roleContoller.updateRoleStatus);
export default router;
