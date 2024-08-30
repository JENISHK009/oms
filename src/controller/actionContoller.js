import { pool } from '../config/index.js';
import { sendSuccess } from '../utils/index.js';

const getSellerActions = async (req, res) => {
  try {
    const query = `
        SELECT id, "name"
        FROM OMS."actions"
        WHERE "isSystemAction" = false AND status = 'active' order by id desc;
      `;

    const result = await pool.query(query);

    sendSuccess(res, null, result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
export default { getSellerActions };
