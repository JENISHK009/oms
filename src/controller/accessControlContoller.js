import { pool } from '../config/index.js';
import { sendSuccess } from '../utils/index.js';

const addUpdateRoleAccessControl = async (req, res) => {
  try {
    const { roleId, roleName, permission } = req.body;
    const currentUser = req.currentUser;

    if (
      !Array.isArray(permission) ||
      permission.some((p) => typeof p !== 'object')
    ) {
      return res.status(400).json({ error: 'Invalid permission format' });
    }

    let updatedRoleId = roleId;

    if (roleName) {
      const existingRoleQuery = `
        SELECT id FROM OMS."roles"
        WHERE "name" = $1 AND "isSystemRole" = false and "createdBy" = $2;
      `;
      const existingRoleResult = await pool.query(existingRoleQuery, [
        roleName,
        currentUser.id,
      ]);
      const existingRole = existingRoleResult.rows[0];
      if (existingRole) {
        return res
          .status(400)
          .json({ error: 'Role already exists with the same name' });
      } else {
        const roleQuery = `
          INSERT INTO OMS."roles" ("name", "createdBy")
          VALUES ($1, $2)
          RETURNING id;
        `;
        const roleResult = await pool.query(roleQuery, [
          roleName,
          currentUser.id,
        ]);
        const newRole = roleResult.rows[0];
        updatedRoleId = newRole.id;
      }
    }

    if (!updatedRoleId) {
      return res.status(400).json({ error: 'Role ID could not be determined' });
    }

    let roleExist = await pool.query(
      `select * from oms."roles" where id = $1 and "isSystemRole" = false and "createdBy" = $2`,
      [updatedRoleId, currentUser.id]
    );

    if (!roleExist.rows[0]) {
      return res.status(400).json({ error: `Role not found` });
    }

    for (const perm of permission) {
      const [moduleId, actions] = Object.entries(perm)[0];
      const moduleQuery = `
        SELECT id FROM OMS."modules"
        WHERE "id" = $1 and "isSystemModule" = false;
      `;
      const moduleResult = await pool.query(moduleQuery, [moduleId]);

      if (moduleResult.rows.length === 0) {
        return res.status(400).json({ error: `Module ${moduleId} not found` });
      }

      const existingActionsQuery = `
        SELECT id, "name" FROM OMS."actions"
        WHERE "name" = ANY($1) and "isSystemAction" = false;
      `;
      const existingActionsResult = await pool.query(existingActionsQuery, [
        actions,
      ]);
      const existingActionsMap = new Map(
        existingActionsResult.rows.map((a) => [a.name, a.id])
      );

      const actionsToCreate = actions.filter((a) => !existingActionsMap.has(a));

      if (actionsToCreate.length > 0) {
        const createActionsQuery = `
          INSERT INTO OMS."actions" ("name", status, "createdBy")
          VALUES ${actionsToCreate
            .map(
              (_, i) =>
                `($${i + 1}, 'active', $${i + actionsToCreate.length + 1})`
            )
            .join(', ')}
          RETURNING id, "name";
        `;
        const createActionsValues = [
          ...actionsToCreate,
          ...actionsToCreate.map(() => currentUser.id),
        ];
        const createActionsResult = await pool.query(
          createActionsQuery,
          createActionsValues
        );
        createActionsResult.rows.forEach((row) => {
          existingActionsMap.set(row.name, row.id);
        });
      }

      const actionIds = actions
        .map((a) => existingActionsMap.get(a))
        .filter((id) => id !== undefined);

      const accessControlQuery = `
        SELECT * FROM OMS."roleAccessControl"
        WHERE "moduleId" = $1 AND "roleId" = $2;
      `;
      const accessControlResult = await pool.query(accessControlQuery, [
        moduleId,
        updatedRoleId,
      ]);

      if (accessControlResult.rows.length > 0) {
        const updateQuery = `
          UPDATE OMS."roleAccessControl"
          SET action = $1, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "moduleId" = $2 AND "roleId" = $3
          RETURNING *;
        `;
        await pool.query(updateQuery, [actionIds, moduleId, updatedRoleId]);
      } else {
        const createQuery = `
          INSERT INTO OMS."roleAccessControl" ("moduleId", "roleId", action, "createdBy")
          VALUES ($1, $2, $3, $4)
          RETURNING *;
        `;
        await pool.query(createQuery, [
          moduleId,
          updatedRoleId,
          actionIds,
          currentUser.id,
        ]);
      }
    }

    sendSuccess(res, 'Role access control updated successfully');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getAccessControlsByRoleId = async (req, res) => {
  try {
    const { roleId } = req.query;
    const currentUser = req.currentUser;
    if (!roleId) {
      return res
        .status(400)
        .json({ success: false, error: 'RoleId is required' });
    }

    const roleData = await pool.query(
      `select * from oms."roles" where id = $1 and "isSystemRole" = false and "createdBy" = $2`,
      [roleId, currentUser.id]
    );

    if (!roleData.rows[0]) {
      return res.status(400).json({ success: false, error: 'Invalid Role' });
    }
    const modulesQuery = `
      SELECT 
        m.id AS "moduleId",
        m.name AS module,
        m."moduleActions" AS "moduleActions"
      FROM OMS."modules" m
      WHERE m.status = 'active' and m."isSystemModule" = false order by m.id desc
    `;
    const modulesResult = await pool.query(modulesQuery);

    const actionNamesQuery = `
      SELECT id, "name" FROM OMS."actions" WHERE "isSystemAction" = false AND status = 'active' order by id desc
    `;
    const actionNamesResult = await pool.query(actionNamesQuery);
    const actionNamesMap = actionNamesResult.rows.reduce((acc, action) => {
      acc[action.name] = action.id;
      return acc;
    }, {});

    const actionsQuery = `
      SELECT
        rac."moduleId",
        a."name" AS action_name
      FROM OMS."roleAccessControl" rac
      JOIN OMS."actions" a
        ON a.id::text = ANY(rac.action)
      WHERE rac."roleId" = $1 AND rac.status = 'active' order by a.id desc
    `;
    const actionsResult = await pool.query(actionsQuery, [roleId]);

    const actionsMap = actionsResult.rows.reduce((acc, row) => {
      acc[row.moduleId] = acc[row.moduleId] || new Set();
      acc[row.moduleId].add(row.action_name);
      return acc;
    }, {});

    const data = modulesResult.rows.map((module) => {
      const actionIds = module.moduleActions || [];

      const actions = Object.keys(actionNamesMap).map((actionName) => {
        const actionId = actionNamesMap[actionName];
        const isActionInModule = actionIds.includes(actionId.toString());
        const isActionActive =
          actionsMap[module.moduleId]?.has(actionName) || false;

        const available = isActionInModule;
        const status = available ? isActionActive : false;

        return {
          name: actionName,
          status: status,
          available: available,
        };
      });

      return {
        moduleId: module.moduleId,
        module: module.module,
        action: actions,
      };
    });

    sendSuccess(res, null, data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const addUpdateUserAccessControl = async (req, res) => {
  try {
    const payload = req.body;

    const currentUser = req.currentUser;
    let accessControl;

    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({
        error: 'An array of userId, moduleId, and action is required',
      });
    }

    for (const accessControlData of payload) {
      const { userId, moduleId, action } = accessControlData;

      if (!userId || !moduleId || !action) {
        return res
          .status(400)
          .json({ error: 'userId, moduleId, and action are required' });
      }

      const userQuery = `SELECT * FROM OMS."users" WHERE id = $1 and "deletedAt" is null`;
      const userResult = await pool.query(userQuery, [userId]);
      if (!userResult.rows[0]) {
        return res.status(400).json({ error: 'User not found' });
      }

      const moduleQuery = `SELECT * FROM OMS."modules" WHERE id = $1`;
      const moduleResult = await pool.query(moduleQuery, [moduleId]);
      if (!moduleResult.rows[0]) {
        return res.status(400).json({ error: 'Module not found' });
      }

      const accessControlQuery = `
        SELECT * FROM OMS."userAccessControl"
        WHERE "userId" = $1 AND "moduleId" = $2
      `;
      const accessControlResult = await pool.query(accessControlQuery, [
        userId,
        moduleId,
      ]);
      accessControl = accessControlResult.rows[0];

      if (accessControl) {
        const updateQuery = `
          UPDATE OMS."userAccessControl"
          SET action = $1, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "userId" = $2 AND "moduleId" = $3
          RETURNING *
        `;
        const updateValues = [action, userId, moduleId];
        const updateResult = await pool.query(updateQuery, updateValues);
        accessControl = updateResult.rows[0];
      } else {
        const createQuery = `
          INSERT INTO OMS."userAccessControl"
          ("userId", "moduleId", action, "createdBy")
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        const createValues = [userId, moduleId, action, currentUser.id];
        const createResult = await pool.query(createQuery, createValues);
        accessControl = createResult.rows[0];
      }
    }

    sendSuccess(res, null, accessControl);
  } catch (error) {
    console.error(error);
    res.status(500).json({ data: null, error: error.message });
  }
};

const getAccessControlsByUserId = async (req, res) => {
  try {
    const userId = req.query.userId || req.currentUser.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const allModulesQuery = `
      SELECT id AS "moduleId", name AS module
      FROM OMS."modules"
    `;
    const allModulesResult = await pool.query(allModulesQuery);

    const allModules = allModulesResult.rows.map(({ moduleId, module }) => ({
      moduleId,
      module,
    }));

    const userRoleQuery = `
      SELECT r.id AS "roleId"
      FROM OMS."users" u
      JOIN OMS."roles" r ON u."roleId" = r.id
      WHERE u.id = $1 and u."isSystemRole" = true;
    `;
    const userRoleResult = await pool.query(userRoleQuery, [userId]);

    if (!userRoleResult.rows[0]) {
      return res.status(400).json({ error: 'User role not found' });
    }

    const roleId = userRoleResult.rows[0].roleId;

    const rolePermissionsQuery = `
    SELECT 
      m.id AS "moduleId",
      m.name AS module,
      ac.id AS "accessControlId",
      ac.action
    FROM OMS."modules" m
    INNER JOIN OMS."roleAccessControl" ac ON m.id = ac."moduleId" AND ac."roleId" = $1
  `;
    const rolePermissionsResult = await pool.query(rolePermissionsQuery, [
      roleId,
    ]);
    const rolePermissions = rolePermissionsResult.rows.map(
      ({ moduleId, module, accessControlId, action, status }) => ({
        moduleId,
        module,
        accessControlId,
        action,
        status,
      })
    );

    const userPermissionsQuery = `
    SELECT 
      m.id AS "moduleId",
      m.name AS module,
      ac.id AS "accessControlId",
      ac.action
    FROM OMS."modules" m
    INNER JOIN OMS."userAccessControl" ac ON m.id = ac."moduleId" AND ac."userId" = $1
  `;
    const userPermissionsResult = await pool.query(userPermissionsQuery, [
      userId,
    ]);

    const userPermissions = userPermissionsResult.rows.map(
      ({ moduleId, module, accessControlId, action, status }) => ({
        moduleId,
        module,
        accessControlId,
        action,
        status,
      })
    );

    const mergedPermissions = allModules.map((module) => {
      const rolePermission = rolePermissions.find(
        (rp) => rp.moduleId === module.moduleId
      );
      const userPermission = userPermissions.find(
        (up) => up.moduleId === module.moduleId
      );

      if (userPermission) {
        return {
          ...module,
          accessControlId: userPermission.accessControlId,
          action: userPermission.action || null,
          status: userPermission.status,
        };
      } else {
        if (rolePermission) {
          return {
            ...module,
            accessControlId: rolePermission.accessControlId,
            action: rolePermission.action || null,
            status: rolePermission.status,
          };
        }
      }
      return { ...module, action: null };
    });

    sendSuccess(res, null, mergedPermissions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ data: null, error: error.message });
  }
};

export default {
  addUpdateRoleAccessControl,
  getAccessControlsByRoleId,
  addUpdateUserAccessControl,
  getAccessControlsByUserId,
};
