import express from 'express';
import { accessContoller } from '../controller/index.js';

const router = express.Router();

router
  .patch(
    '/addUpdateRoleAccessControl',
    accessContoller.addUpdateRoleAccessControl
  )
  .get('/getAccessControlsByRoleId', accessContoller.getAccessControlsByRoleId)
  .patch(
    '/addUpdateUserAccessControl',
    accessContoller.addUpdateUserAccessControl
  )
  .get('/getAccessControlsByUserId', accessContoller.getAccessControlsByUserId);

export default router;
