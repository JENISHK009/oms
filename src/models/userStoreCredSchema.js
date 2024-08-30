export const createUserStoreCredTable = `
CREATE TABLE IF NOT EXISTS OMS."userStoreCred" (
    id SERIAL PRIMARY KEY,
    "storeId" INTEGER NOT NULL,
    email VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inActive'))
);
`;
