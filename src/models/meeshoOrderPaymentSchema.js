export const createMeeshoOrdersPaymentTable = `
  CREATE TABLE IF NOT EXISTS OMS."meeshoOrdersPayment" (
	"userId" int4 NULL,
	"orderNumber" varchar(255) NULL,
	"subOrderNumber" varchar(255) NULL,
	"productSku" varchar(255) NULL,
	status varchar(50) NULL,
	"paymentDate" timestamp NULL,
	amount numeric(10, 2) NULL,
	penalty numeric(10, 2) NULL,
	netamount numeric(10, 2) NULL,
	returnshippingcharge numeric(10, 2) NULL,
	CONSTRAINT unique_order_suborder_payment_date UNIQUE ("orderNumber", "subOrderNumber", "paymentDate")
);`;
