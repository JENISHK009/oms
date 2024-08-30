export const createpaymentHistoryTable = `
CREATE TABLE IF NOT EXISTS OMS."paymentHistory" (
    id SERIAL PRIMARY KEY,   
    "paymentId"  VARCHAR(50) ,
    "customerName" VARCHAR(70) ,
    "paymentGateway" VARCHAR(30) NOT NULL,
    "amount" INTEGER ,
    "currency" VARCHAR(10) ,
    "paymentMethod" VARCHAR(10) ,
    "status" VARCHAR(10) ,
    "email" VARCHAR(70) ,
    "error" TEXT DEFAULT NULL,   
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP    
);
`;
