import { pool } from '../config/index.js';
import { paginate, sendSuccess } from '../utils/index.js';
import { PassThrough } from 'stream';
import pkg from 'exceljs';
const { Workbook } = pkg;

const createRole = async (req, res) => {
  try {
    let { name, description } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!description || description.trim() === '') {
      return res.status(400).json({ error: 'Description is required' });
    }

    name = name.toUpperCase();

    const currentUser = req.currentUser;

    const existingRole = await pool.query(
      `SELECT * FROM OMS."roles" WHERE name = $1 and "createdBy" = $2`,
      [name, currentUser.id]
    );

    if (existingRole.rows[0]) {
      return res.status(400).json({ error: 'Role already exists' });
    }

    const result = await pool.query(
      `INSERT INTO OMS."roles" (name, description,"createdBy") VALUES ($1, $2, $3) RETURNING *`,
      [name, description, currentUser.id]
    );

    const role = result.rows[0];
    sendSuccess(res, 'Role created successfully', role);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getAllRoles = async (req, res) => {
  try {
    const currentUser = req.currentUser;

    let query = `
    SELECT 
      ar.*,
      CAST(COALESCE(COUNT(au.id), 0) AS INTEGER) AS "userCount"
    FROM 
      OMS."roles" ar
    LEFT JOIN 
      OMS."users" au ON ar.id = au."roleId" 
    WHERE ar."isSystemRole" = false and au."deletedAt" is null
    AND ar."createdBy" = ${currentUser.id}
  `;

    let countQuery = `
    SELECT 
      COUNT(DISTINCT ar.id) AS count
    FROM 
      OMS."roles" ar
    LEFT JOIN 
      OMS."users" au ON ar.id = au."roleId"
    WHERE ar."isSystemRole" = false and au."deletedAt" is null
    AND ar."createdBy" = ${currentUser.id}
  `;

    const { name, status, search, page = 1, limit = 10 } = req.query;

    if (name) {
      query += ` AND LOWER(ar.name) = LOWER('${name.trim()}')`;
      countQuery += ` AND LOWER(ar.name) = LOWER('${name.trim()}')`;
    }

    if (status) {
      query += ` AND ar.status = '${status.trim()}'`;
      countQuery += ` AND ar.status = '${status.trim()}'`;
    }

    if (search) {
      query += ` AND LOWER(ar.name) LIKE '%${search.trim().toLowerCase()}%'`;
      countQuery += ` AND LOWER(ar.name) LIKE '%${search
        .trim()
        .toLowerCase()}%'`;
    }

    query += ` GROUP BY ar.id, ar.name, ar.status, ar."createdAt", ar."updatedAt"`;
    query += ` ORDER BY ar."id" desc`;

    let responseData = await paginate(query, countQuery, page, limit);

    sendSuccess(res, 'Roles fetched successfully', {
      roles: responseData.data,
      pagination: responseData.pagination,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getRole = async (req, res) => {
  try {
    const { id } = req.query;

    const result = await pool.query(
      `SELECT * FROM OMS."roles" ar WHERE id = $1 and ar."isSystemRole" = false and "createdBy" = $2`,
      [id]
    );

    const role = result.rows[0];

    if (!role) {
      return res.status(400).json({ error: 'Role not found' });
    }
    sendSuccess(res, 'Role fetched successfully', role);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.body;
    const updateFields = {};

    const currentUser = req.currentUser;

    if (req.body.name) updateFields.name = req.body.name;
    if (req.body.description) updateFields.description = req.body.description;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const existingRole = (
      await pool.query(
        `SELECT * FROM OMS."roles" WHERE id = $1 and "createdBy" = $2`,
        [id, currentUser.id]
      )
    ).rows[0];

    if (!existingRole) {
      return res.status(400).json({ error: 'Role not found' });
    }

    const existingName = await pool.query(
      `SELECT * FROM OMS."roles" WHERE name = $1 and "createdBy" = $2`,
      [req.body.name, currentUser.id]
    );

    if (existingName.rows[0]) {
      return res.status(400).json({ error: 'Role name already exists' });
    }
    const query = `UPDATE OMS."roles" SET ${Object.keys(updateFields)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ')} WHERE id = $${
      Object.keys(updateFields).length + 1
    } RETURNING *`;
    const values = [...Object.values(updateFields), id];

    const result = await pool.query(query, values);

    const role = result.rows[0];

    if (!role) {
      return res.status(400).json({ error: 'Role not found' });
    }
    sendSuccess(res, 'Role updated successfully', role);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.query;
    const currentUser = req.currentUser;

    const existingRole = (
      await pool.query(
        `SELECT * FROM OMS."roles" WHERE id = $1 and "createdBy" = $2`,
        [id, currentUser.id]
      )
    ).rows[0];

    if (!existingRole) {
      return res.status(400).json({ error: 'Role not found' });
    }

    const usersWithRole = (
      await pool.query(
        `SELECT COUNT(*) FROM OMS."users" WHERE "roleId" = $1 and "isVerified" = true and "deletedAt" is null`,
        [id]
      )
    ).rows[0].count;

    if (parseInt(usersWithRole, 10) > 0) {
      return res
        .status(400)
        .json({ error: 'Cannot delete role as it is assigned to users.' });
    }
    await pool.query(`DELETE FROM OMS."roles" WHERE id = $1`, [id]);
    sendSuccess(res, 'Role deleted successfully');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const updateRoleStatus = async (req, res) => {
  try {
    const { id, status } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Role ID is required' });
    }

    if (!status || (status !== 'active' && status !== 'inActive')) {
      return res
        .status(400)
        .json({ error: "Invalid status. Must be 'active' or 'inActive'" });
    }

    const existingRole = (
      await pool.query(
        `SELECT * FROM OMS."roles" WHERE id = $1 and "createdBy" = $2`,
        [id, currentUser.id]
      )
    ).rows[0];

    if (!existingRole) {
      return res.status(400).json({ error: 'Role not found' });
    }

    const query = `UPDATE OMS."roles" SET status = $1 WHERE id = $2 RETURNING *`;
    const values = [status, id];

    const result = await pool.query(query, values);

    const role = result.rows[0];

    if (!role) {
      return res.status(400).json({ error: 'Role not found' });
    }
    sendSuccess(res, `Role status updated to ${status}`, role);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const exportRolesToXLSX = async (req, res) => {
  try {
    const { name, status, search } = req.query;
    const currentUser = req.currentUser;
    let query = `
      SELECT 
        ar."name", 
        ar.status, 
        ar."createdAt", 
        ar."updatedAt"
      FROM 
        OMS."roles" ar
      WHERE ar."isSystemRole" = false and "createdBy" = ${currentUser.id}
    `;

    let whereClause = ``;

    if (name) {
      whereClause += ` AND LOWER(ar.name) = LOWER('${name}')`;
    }

    if (status) {
      whereClause += ` AND ar.status = '${status}'`;
    }

    if (search) {
      whereClause += ` AND LOWER(ar.name) LIKE '%${search.toLowerCase()}%'`;
    }

    let roles = await pool.query(query);

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Roles');

    worksheet.columns = [
      { header: 'Name', key: 'name' },
      { header: 'Status', key: 'status' },
      { header: 'Created At', key: 'createdAt' },
    ];

    roles = roles.rows;
    roles.forEach((role) => {
      worksheet.addRow({
        name: role.name,
        status: role.status,
        createdAt: role.createdAt,
      });
    });

    const passThroughStream = new PassThrough();

    res.setHeader('Content-Disposition', 'attachment; filename=roles.xlsx');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    await workbook.xlsx.write(passThroughStream);

    passThroughStream.pipe(res);

    passThroughStream.on('end', () => {
      res.end();
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  createRole,
  getAllRoles,
  getRole,
  updateRole,
  deleteRole,
  updateRoleStatus,
  exportRolesToXLSX,
};
