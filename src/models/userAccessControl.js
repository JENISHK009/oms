export const createUserAccessControlTable = `
  CREATE TABLE IF NOT EXISTS OMS."userAccessControl" (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL ,
    "moduleId" INTEGER NOT NULL ,
    action VARCHAR(255)[] NOT NULL,  
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL
  );
`;
