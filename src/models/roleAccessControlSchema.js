export const createRoleAccessContoleTable = `
CREATE TABLE IF NOT EXISTS OMS."roleAccessControl" (
    id SERIAL PRIMARY KEY,
    "moduleId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    action VARCHAR(255)[] NOT NULL,  
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inActive'))
  );
`;
