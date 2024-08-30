export const createUserTopicTable = `
  CREATE TABLE IF NOT EXISTS OMS."userTopic" (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,    
    "topics" INTEGER[] NOT NULL,  
    "deletedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    CONSTRAINT unique_user_topic UNIQUE("userId")
  );
`;
