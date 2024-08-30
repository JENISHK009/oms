import { pool } from '../config/index.js';
import { sendSuccess } from '../utils/index.js';

const getAllStores = async (req, res) => {
  try {
    const { name, active, search, page, limit } = req.query;

    let query = `
      SELECT id, name, "image"
      FROM OMS."stores" where active = true
    `;

    let whereClause = '';
    const queryParams = [];

    if (name) {
      whereClause += ` AND name = $${queryParams.length + 1}`;
      queryParams.push(name);
    }

    if (active) {
      whereClause += ` AND active = $${queryParams.length + 1}`;
      queryParams.push(active === 'true');
    }

    if (search) {
      whereClause += ` AND name ILIKE $${queryParams.length + 1}`;
      queryParams.push(`%${search}%`);
    }

    if (whereClause) {
      query = query + ' WHERE 1=1' + whereClause;
      countQuery = countQuery + ' WHERE 1=1' + whereClause;
    }

    query += ` ORDER BY id DESC`;

    const stores = await pool.query(query);

    const baseUrl = process.env.BASE_URL;

    const storesWithImageUrl = stores.rows.map((store) => ({
      id: store.id,
      name: store.name,
      imageUrl: store.image ? `${baseUrl}/images/${store.image}` : null,
      active: store.active,
    }));

    sendSuccess(res, null, {
      stores: storesWithImageUrl,
      pagination: stores.pagination,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  getAllStores,
};
