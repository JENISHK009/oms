import { pool } from '../config/index.js';

async function paginate(query, countQuery, page = 1, limit = 10, queryParams) {
  page = Number(page) || 1;
  limit = Number(limit) || 10;

  const offset = (page - 1) * limit;

  query += ` OFFSET ${offset} LIMIT ${limit}`;

  let result, countResult, totalCount;
  if (!queryParams) {
    result = await pool.query(query);

    countResult = await pool.query(countQuery);
    totalCount = countResult.rows[0].count;
  } else {
    result = await pool.query(query, queryParams);

    countResult = await pool.query(countQuery, queryParams);
    totalCount = countResult.rows[0].count;
  }

  return {
    data: result.rows,
    pagination: {
      limit,
      page,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}

export { paginate };
