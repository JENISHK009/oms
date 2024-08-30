export const createFirebaseNotificationTable = `
  CREATE TABLE IF NOT EXISTS OMS."firebaseNotification" (
    id SERIAL PRIMARY KEY,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "imageUrl" VARCHAR(255) NOT NULL,
    "firebaseId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;
