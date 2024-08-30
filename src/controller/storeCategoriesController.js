import { pool } from '../config/index.js';
import { sendSuccess } from '../utils/index.js';

const getAllStoreCategories = async (req, res) => {
  try {
    const { name, active, search, page, limit } = req.query;

    let query = `
      SELECT id, name, active, "createdAt"
      FROM OMS."storeCategories"
      WHERE active = true 
    `;

    const queryParams = [];

    if (name) {
      query += ` AND name = $${queryParams.length + 1}`;
      queryParams.push(name);
    }

    if (active) {
      query += ` AND active = $${queryParams.length + 1}`;
      queryParams.push(active === 'true');
    }

    if (search) {
      query += ` AND name ILIKE $${queryParams.length + 1}`;
      queryParams.push(`%${search}%`);
    }
    query += 'order by id desc';
    const result = await pool.query(query, queryParams);

    sendSuccess(res, null, result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  getAllStoreCategories,
};
