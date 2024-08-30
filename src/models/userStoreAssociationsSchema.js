export const createUserStoreAssociationsTabel = `
CREATE TABLE IF NOT EXISTS OMS."userStoreAssociations" (
    id SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "userId" INTEGER NOT NULL,
    "storeIds" TEXT[], 
    "storeCategoryIds" TEXT[],
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
