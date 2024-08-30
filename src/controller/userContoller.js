import { pool } from '../config/index.js';
import bcrypt from 'bcrypt';
import { adminRoleName } from '../enum/contant.js';
import { paginate, sendSuccess, generateAuthToken } from '../utils/index.js';

import { PassThrough } from 'stream';
import pkg from 'exceljs';
const { Workbook } = pkg;

const createUser = async (req, res) => {
  try {
    const { name, email, mobileNumber, countryCode, roleId, password, active } =
      req.body;

    const currentUser = req.currentUser;
    const missingFields = [];

    if (!name) missingFields.push('name');
    if (!email) missingFields.push('email');
    if (!mobileNumber) missingFields.push('mobileNumber');
    if (!countryCode) missingFields.push('countryCode');
    if (!roleId) missingFields.push('roleId');
    if (!password) missingFields.push('password');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `The following fields are required: ${missingFields.join(', ')}`,
      });
    }

    const passwordValidation =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordValidation.test(password)) {
      return res.status(400).json({
        error:
          'Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number, and one special character',
      });
    }

    const mobileNumberValidation = /^\d{8,12}$/;
    if (!mobileNumberValidation.test(mobileNumber)) {
      return res.status(400).json({
        error: 'Mobile number must be between 8 to 12 digits',
      });
    }

    const emailLowerCase = email.toLowerCase();

    const existingUserQuery = `
      SELECT * FROM OMS."users"
      WHERE (LOWER(email) = $1 OR ("mobileNumber" = $2 AND "countryCode" = $3))
        AND "isVerified" = true and "deletedAt" is null
    `;
    const existingUserValues = [emailLowerCase, mobileNumber, countryCode];
    const existingUserResult = await pool.query(
      existingUserQuery,
      existingUserValues
    );

    if (existingUserResult.rows.length > 0) {
      const existingUser = existingUserResult.rows[0];
      if (existingUser.email.toLowerCase() == emailLowerCase) {
        return res.status(400).json({ error: 'Email already exists' });
      } else {
        return res.status(400).json({ error: 'Mobile number already exists' });
      }
    }

    const roleResult = await pool.query(
      `SELECT * FROM OMS."roles" WHERE "id" = $1 and "createdBy" = $2`,
      [roleId, currentUser.id]
    );

    if (!roleResult.rows[0]) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (currentUser.roleId === roleId) {
      return res.status(400).json({
        error: 'You cannot create a user with the same role as yourself',
      });
    }

    const isPasswordChange = roleId === adminRoleName['SELLER'] ? true : false;

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
        INSERT INTO OMS."users" (
          "name", email, "mobileNumber", "countryCode", "roleId", "password", "active", "isVerified", "createdBy","isPasswordChange"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING *
      `,
      [
        name,
        emailLowerCase,
        mobileNumber,
        countryCode,
        roleId,
        hashedPassword,
        active !== undefined ? active : false,
        true,
        currentUser.id,
        isPasswordChange,
      ]
    );

    const adminUser = result.rows[0];
    sendSuccess(res, 'User created successfully', adminUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const {
      active,
      roleId,
      roleName,
      mobileNumber,
      email,
      name,
      search,
      countryCode,
      limit = 10,
      page = 1,
    } = req.query;
    const currentUser = req.currentUser;

    const trimmedRoleName = roleName ? roleName.trim() : '';
    const trimmedEmail = email ? email.trim() : '';
    const trimmedName = name ? name.trim() : '';
    const trimmedSearch = search ? search.trim() : '';
    const trimmedCountryCode = countryCode ? countryCode.trim() : '';

    let query = `
      SELECT 
        au.id,
        au."name", 
        au.email, 
        au."mobileNumber", 
        au."countryCode", 
        au.active, 
        au."createdAt", 
        au."updatedAt", 
        json_build_object('id', ar.id, 'name', ar.name) AS "role"
      FROM 
        OMS."users" au
      LEFT JOIN 
        OMS."roles" ar ON au."roleId" = ar.id
    `;

    let countQuery = `
      SELECT 
        COUNT(*)
      FROM 
        OMS."users" au
      LEFT JOIN 
        OMS."roles" ar ON au."roleId" = ar.id 
    `;

    let whereClause = ` au.id != ${currentUser.id} AND au."isVerified" = true and au."createdBy" = ${currentUser.id} and au."deletedAt" is null`;
    let countWhereClause = ` au.id != ${currentUser.id} AND au."isVerified" = true and au."createdBy" = ${currentUser.id} and au."deletedAt" is null`;

    if (active) {
      whereClause += ` AND au.active = ${active}`;
      countWhereClause += ` AND au.active = ${active}`;
    }

    if (roleId) {
      whereClause += ` AND au."roleId" = ${roleId}`;
      countWhereClause += ` AND au."roleId" = ${roleId}`;
    }

    if (trimmedRoleName) {
      whereClause += ` AND ar.name = '${trimmedRoleName}'`;
      countWhereClause += ` AND ar.name = '${trimmedRoleName}'`;
    }

    if (mobileNumber) {
      if (trimmedCountryCode) {
        whereClause += ` AND au."mobileNumber" ilike '%${mobileNumber}%' AND au."countryCode" = '${trimmedCountryCode}'`;
        countWhereClause += ` AND au."mobileNumber" ilike '%${mobileNumber}%' AND au."countryCode" = '${trimmedCountryCode}'`;
      } else {
        whereClause += ` AND au."mobileNumber" ilike '%${mobileNumber}%'`;
        countWhereClause += ` AND au."mobileNumber" ilike '%${mobileNumber}%'`;
      }
    }

    if (trimmedEmail) {
      whereClause += ` AND au.email ilike '%${trimmedEmail}%'`;
      countWhereClause += ` AND au.email ilike '%${trimmedEmail}%'`;
    }

    if (trimmedName) {
      whereClause += ` AND au."name" ilike '%${trimmedName}%'`;
      countWhereClause += ` AND au."name" ilike '%${trimmedName}%'`;
    }

    if (trimmedSearch) {
      whereClause += ` AND (au."name" ILIKE '%${trimmedSearch}%' OR au.email ILIKE '%${trimmedSearch}%' OR au."mobileNumber" ILIKE '%${trimmedSearch}%') `;
      countWhereClause += ` AND (au."name" ILIKE '%${trimmedSearch}%' OR au.email ILIKE '%${trimmedSearch}%' OR au."mobileNumber" ILIKE '%${trimmedSearch}%') `;
    }

    if (countWhereClause) {
      countQuery += ` WHERE ${countWhereClause}`;
    }
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }
    query += ` ORDER BY au."id" desc`;

    let responseData = await paginate(query, countQuery, page, limit);

    sendSuccess(res, 'Users fetched successfully', {
      data: responseData.data,
      pagination: responseData.pagination,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.query;
    const query = `
      SELECT 
        au."name", 
        au.email, 
        au."mobileNumber", 
        au."countryCode", 
        au.active, 
        au."createdAt", 
        au."updatedAt", 
        json_build_object('id', ar.id, 'name', ar.name) AS "role"
      FROM 
        OMS."users" au
      LEFT JOIN 
        OMS."roles" ar ON au."roleId" = ar.id
      WHERE 
        au.id = $1 and "isVerified" = true and au."createdBy" is null and au."deletedAt" is null
    `;
    const result = await pool.query(query, [id]);
    const user = result.rows[0];
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }
    sendSuccess(res, null, user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.query;
    const currentUser = req.currentUser;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid or missing id parameter' });
    }
    const query = `
    DELETE FROM OMS."users"
    WHERE id = $1 and "createdBy" = $2
  `;
    const result = await pool.query(query, [id, currentUser.id]);

    if (result.rowCount === 0) {
      return res.status(400).json({ error: `User not found` });
    }

    sendSuccess(res, `User deleted successfully`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const {
      id,
      name,
      email,
      mobileNumber,
      countryCode,
      roleId,
      active,
      password,
    } = req.body;

    const currentUser = req.currentUser;

    if (currentUser.id === parseInt(id)) {
      if (roleId != currentUser.roleId) {
        return res
          .status(400)
          .json({ error: 'You cannot update your own user' });
      }
    }

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid or missing id parameter' });
    }

    if (parseInt(id) <= 0) {
      return res.status(400).json({ error: 'id must be a positive integer' });
    }

    const emailLowerCase = email ? email.toLowerCase() : null;

    const existingUserQuery = `
      SELECT id, email, "mobileNumber"
      FROM OMS."users"
      WHERE (LOWER(email) = $1 OR ("mobileNumber" = $2 AND "countryCode" = $3))
      AND id != $4 and "isVerified" = true and "deletedAt" is null
    `;

    const existingUserValues = [emailLowerCase, mobileNumber, countryCode, id];
    const existingUserResult = await pool.query(
      existingUserQuery,
      existingUserValues
    );

    if (existingUserResult.rows.length > 0) {
      const existingUser = existingUserResult.rows[0];
      if (existingUser.email === emailLowerCase) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      if (existingUser.mobileNumber == mobileNumber) {
        return res.status(400).json({ error: 'Mobile number already exists' });
      }
    }

    let query = `UPDATE OMS."users" SET `;
    let values = [];

    if (name) {
      query += `name = $${values.length + 1}, `;
      values.push(name);
    }

    if (emailLowerCase) {
      query += `email = $${values.length + 1}, `;
      values.push(emailLowerCase);
    }

    if (mobileNumber) {
      query += `"mobileNumber" = $${values.length + 1}, `;
      values.push(mobileNumber);
    }

    if (countryCode) {
      query += `"countryCode" = $${values.length + 1}, `;
      values.push(countryCode);
    }

    if (roleId) {
      query += `"roleId" = $${values.length + 1}, `;
      values.push(roleId);
    }

    if (active !== undefined) {
      if (typeof active === 'boolean') {
        query += `active = $${values.length + 1}, `;
        values.push(active);
      } else {
        return res
          .status(400)
          .json({ error: 'Active field must be a boolean' });
      }
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `password = $${values.length + 1}, `;
      values.push(hashedPassword);
    }

    query = query.trim().replace(/,$/, '');
    query += ` WHERE id = $${values.length + 1} and "createdBy" = $${
      values.length + 2
    }`;
    values.push(id);
    values.push(currentUser.id);

    await pool.query(query, values);

    sendSuccess(res, `User updated successfully`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id, active } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid or missing id parameter' });
    }

    if (parseInt(id) <= 0) {
      return res.status(400).json({ error: 'id must be a positive integer' });
    }

    const currentUser = req.currentUser;

    if (currentUser.id === parseInt(id)) {
      return res
        .status(400)
        .json({ error: 'You cannot update your own status' });
    }

    const userResult = await pool.query(
      `SELECT * FROM OMS."users" WHERE id = $1 and "createdBy" = $2 and "deletedAt" is null`,
      [id, currentUser.id]
    );

    if (!userResult.rows[0]) {
      return res.status(400).json({ error: 'User not found' });
    }

    const query = `UPDATE OMS."users" SET active = $1 WHERE id = $2`;
    await pool.query(query, [active, id]);

    sendSuccess(res, `User status updated successfully`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const exportUsersToXLSX = async (req, res) => {
  try {
    const {
      active,
      roleId,
      roleName,
      mobileNumber,
      email,
      name,
      search,
      countryCode,
    } = req.query;

    const currentUser = req.currentUser;

    const trimmedRoleName = roleName ? roleName.trim() : '';
    const trimmedEmail = email ? email.trim() : '';
    const trimmedName = name ? name.trim() : '';
    const trimmedSearch = search ? search.trim() : '';
    const trimmedCountryCode = countryCode ? countryCode.trim() : '';

    let query = `
      SELECT 
        au."name", 
        au.email, 
        au."mobileNumber", 
        au."countryCode", 
        au.active, 
        au."createdAt", 
        au."updatedAt", 
        json_build_object('id', ar.id, 'name', ar.name) AS "role"
      FROM 
        OMS."users" au
      LEFT JOIN 
        OMS."roles" ar ON au."roleId" = ar.id
    `;

    let whereClause = ` au.id != ${currentUser.id} AND au."isVerified" = true AND au."createdBy" = ${currentUser.id} and au."deletedAt" is null `;

    if (active) {
      whereClause += ` AND au.active = '${active}'`;
    }

    if (roleId) {
      whereClause += ` AND au."roleId" = ${roleId}`;
    }

    if (trimmedRoleName) {
      whereClause += ` AND ar.name = '${trimmedRoleName}'`;
    }

    if (mobileNumber) {
      if (trimmedCountryCode) {
        whereClause += ` AND au."mobileNumber" = '${mobileNumber}' AND au."countryCode" = '${trimmedCountryCode}'`;
      } else {
        whereClause += ` AND au."mobileNumber" = '${mobileNumber}'`;
      }
    }

    if (trimmedEmail) {
      whereClause += ` AND au.email = '${trimmedEmail}'`;
    }

    if (trimmedName) {
      whereClause += ` AND au."name" = '${trimmedName}'`;
    }

    if (trimmedSearch) {
      whereClause += ` AND (au."name" ILIKE '%${trimmedSearch}%' OR au.email ILIKE '%${trimmedSearch}%' OR au."mobileNumber" ILIKE '%${trimmedSearch}%') `;
    }

    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }

    query += `order by au.id desc`;

    let users = await pool.query(query);

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Users');

    worksheet.columns = [
      { header: 'Name', key: 'name' },
      { header: 'Email', key: 'email' },
      { header: 'Mobile Number', key: 'mobileNumber' },
      { header: 'Country Code', key: 'countryCode' },
      { header: 'Active', key: 'active' },
      { header: 'Role Name', key: 'roleName' },
    ];

    users = users.rows;
    users.forEach((user) => {
      worksheet.addRow({
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        countryCode: user.countryCode,
        active: user.active,
        roleName: user.role?.name || '',
      });
    });

    const passThroughStream = new PassThrough();

    res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');
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

const getLoggedInUser = async (req, res) => {
  try {
    const currentUser = req.currentUser;

    const query = `
      SELECT 
       au.*,
        ar."name" as "roleName"
      FROM 
        OMS."users" au
      LEFT JOIN 
        OMS."roles" ar ON au."roleId" = ar.id
      WHERE 
        au.id = $1 AND au."isVerified" = true and au."deletedAt" is null
    `;

    const result = await pool.query(query, [currentUser.id]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const data = await generateAuthToken(user);

    sendSuccess(res, 'User data fetched successfully', data.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getFilterRoles = async (req, res) => {
  try {
    const currentUser = req.currentUser;

    let query = `
      SELECT id, name
      FROM OMS."roles" ar
      WHERE ar."isSystemRole" = false and "createdBy" = ${currentUser.id}
      ORDER BY ar.id desc 
    `;

    const data = await pool.query(query);

    sendSuccess(res, 'Roles fetched successfully', data.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const createTokenForUser = async (req, res) => {
  try {
    const { id } = req.query;
    const currentUser = req.currentUser;
    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const userResult = await pool.query(
      `SELECT u.* ,  r.name as "roleName" 
      FROM OMS."users" as u
      INNER JOIN OMS."roles" r ON u."roleId" = r.id
      WHERE u."id" = $1 and u."createdBy" = $2 and u."deletedAt" is null`,
      [id, currentUser.id]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    if (!user.active) {
      return res.status(400).json({ error: 'User is inactive' });
    }

    let encryptToken;
    let userTokenData = await generateAuthToken(user, currentUser.id);
    encryptToken = userTokenData.token;

    sendSuccess(res, null, { encryptToken, isAdminPanel: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
export default {
  createUser,
  getAllUsers,
  getUserById,
  deleteUser,
  updateUser,
  updateUserStatus,
  exportUsersToXLSX,
  getLoggedInUser,
  getFilterRoles,
  createTokenForUser,
};
