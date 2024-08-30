import { pool } from '../config/index.js';
import { decrypt } from '../utils/index.js';
import jwt from 'jsonwebtoken';

const sellerRoleAuthenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ message: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decryptToken = decrypt(token);
    const verified = jwt.verify(decryptToken, process.env.SECRET_KEY);

    if (!verified) {
      return res
        .status(401)
        .json({ message: 'Unauthorized: Missing or invalid token' });
    }
    const result = await pool.query(
      ` SELECT u.*, r.name AS "roleName"
    FROM OMS."users" u
    INNER JOIN OMS."roles" r ON u."roleId" = r.id
    WHERE u.id = $1 and u."deletedAt" is null`,
      [verified.id]
    );

    if (result.rows.length === 0 || !result.rows[0].active) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    req.currentUser = {
      ...result.rows[0],
      delegateUserId: verified?.delegateUserId,
    };
    next();
  } catch (error) {
    console.error('Error in authenticateJWT:', error);
    return res
      .status(401)
      .json({ message: 'Unauthorized: Missing or invalid token' });
  }
};

export default sellerRoleAuthenticateJWT;
