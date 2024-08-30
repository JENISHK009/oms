import { pool } from '../config/index.js';

const checkSellerRole = async (req, res, next) => {
  try {
    const userId = req.currentUser.id;

    const sellerUserResult = await pool.query(
      `SELECT * FROM oms."users" WHERE id = $1`,
      [userId]
    );
    const sellerRoleResult = await pool.query(
      `SELECT * FROM oms."sellerRoles" WHERE id = $1`,
      [sellerUserResult.rows[0].roleId]
    );

    if (
      sellerUserResult.rows.length === 0 ||
      sellerRoleResult.rows[0].name.toLowerCase() !== 'admin'
    ) {
      return res.status(400).json({ message: 'Access denied. Sellers only.' });
    }

    next();
  } catch (error) {
    console.error('Error in checkSellerRole:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

export { checkSellerRole };
