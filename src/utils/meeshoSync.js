import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import format from 'pg-format';
import axios from 'axios';
import { pool } from '../config/index.js';
import { decrypt } from '../utils/index.js';

puppeteer.use(StealthPlugin());

const MEESHO_ORDER_STATUS = {
  pending: 1,
  'ready to ship': 3,
  shipped: 4,
  cancelled: 5,
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const retryWithBackoff = async (fn, maxRetries = 10, initialDelay = 2000) => {
  for (let retries = 0; retries < maxRetries; retries++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message.includes('429')) {
        await delay(initialDelay * Math.pow(2, retries));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries reached');
};

const scrapeMeeshoOrders = async () => {
  try {
    // const { rows: storeData } = await pool.query(
    //   `SELECT * FROM oms."stores" WHERE name = 'Meesho'`
    // );
    // if (!storeData.length) return;

    // const { rows: userStoreCreds } = await pool.query(
    //   `SELECT email as "encryptedEmail" , password as "encryptedPassword", "userId" FROM OMS."userStoreCred" WHERE "storeId" = $1`,
    //   [storeData[0].id]
    // );

    // for (const userCred of userStoreCreds) {
    //   console.log('userCred', userCred);
    await processUser('chirag32305@live.com', 'Ravi@1234', 625);
    //   await delay(5000); // Minor delay to prevent rate-limiting
    // }
  } catch (error) {
    console.error('Error scraping orders:', error);
  }
};

const processUser = async (email, password, userId) => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    // const loginData = await callMeeshoLoginAPI(email, password);
    // const cookie = generateCookies(loginData);
    // const userData = await fetchUserData(cookie);
    // const { supplier_id, identifier, name } = userData?.suppliers[0];

    // await processOrders(cookie, identifier, supplier_id, name, userId);

    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      // args: ['--start-maximized'],
    });
    const page = await browser.newPage();

    const loginPage = await loginWithBrowser(page, email, password);

    await processReturnOrders(
      loginPage,
      cookie,
      supplier_id,
      identifier,
      userId
    );

    await browser.close();

    // await fetchOrderPayment(
    //   cookie,
    //   supplier_id,
    //   identifier,
    //   yesterday.toISOString().split('T')[0],
    //   userId,
    //   'paid'
    // );

    // for (let i = 0; i <= 14; i++) {
    //   const futureDate = new Date(today);
    //   futureDate.setDate(today.getDate() + i);
    //   fetchOrderPayment(
    //     cookie,
    //     supplier_id,
    //     identifier,
    //     futureDate.toISOString().split('T')[0],
    //     userId,
    //     'pending'
    //   );
    // }
  } catch (error) {
    console.error('Error processing user:', error.message);
  }
};

const fetchUserData = async (cookie) => {
  try {
    const response = await axios.post(
      'https://supplier.meesho.com/growthapi/api/supplier/getUser',
      {},
      {
        headers: {
          authority: 'supplier.meesho.com',
          accept: 'application/json, text/plain, */*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'browser-id': 'NnMgKyAyMnQgKyAxaGN1MDFoY3Iwbw==',
          'client-type': 'd-web',
          'client-version': 'v1',
          'content-type': 'application/json;charset=UTF-8',
          cookie,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching user data:', error.message);
    throw error;
  }
};

const processOrders = async (
  cookie,
  identifier,
  supplier_id,
  supplier_name,
  userId
) => {
  try {
    for (const [statusKey, statusValue] of Object.entries(
      MEESHO_ORDER_STATUS
    )) {
      let allOrders = [];
      let cursor = null;
      const limit = 50;

      while (true) {
        const orderData = await fetchOrders(
          cookie,
          identifier,
          supplier_id,
          supplier_name,
          cursor,
          statusValue,
          limit
        );
        console.log('statusKey', statusKey);
        console.log('orderData.data.groups', orderData);
        if (orderData.data && orderData.data.groups.length > 0) {
          allOrders = [...allOrders, ...orderData.data.groups];
          cursor = orderData.cursor;
        } else {
          break;
        }
      }

      await saveOrdersToDatabase(userId, allOrders, statusKey);
    }
  } catch (error) {
    console.error('Error in processOrders:', error.message);
  }
};

const saveOrdersToDatabase = async (userId, orders, status) => {
  const query = `
    INSERT INTO OMS."meeshoOrders" (
      "userId", "orderNumber", "productName", "productSku", "productId", "variation",
      "quantity", "expected_dispatch_date", "slaStatus", "status", "orderedDate",
      "subOrderNumber", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
    )
    ON CONFLICT ("orderNumber", "subOrderNumber")
    DO UPDATE SET
      "userId" = EXCLUDED."userId",
      "productName" = EXCLUDED."productName",
      "productSku" = EXCLUDED."productSku",
      "productId" = EXCLUDED."productId",
      "variation" = EXCLUDED."variation",
      "quantity" = EXCLUDED."quantity",
      "expected_dispatch_date" = EXCLUDED."expected_dispatch_date",
      "slaStatus" = EXCLUDED."slaStatus",
      "status" = EXCLUDED."status",
      "orderedDate" = EXCLUDED."orderedDate",
      "updatedAt" = NOW();
  `;

  const promises = orders.map((order) => {
    const values = [
      userId,
      order.orders[0].order_num,
      order.orders[0].sub_orders[0].name,
      order.orders[0].sub_orders[0].product_sku,
      order.orders[0].sub_orders[0].product_id,
      order.orders[0].sub_orders[0].variation,
      order.orders[0].sub_orders[0].quantity,
      order.orders[0].sub_orders[0].expected_dispatch_date_iso,
      order.orders[0].sub_orders[0].sla_status,
      status,
      order.orders[0].created_iso,
      order.orders[0].sub_orders[0].sub_order_num,
    ];

    return pool.query(query, values);
  });

  await Promise.all(promises);
  console.log(`Saved ${orders.length} orders with status ${status}`);
};

const processReturnOrders = async (
  page,
  cookie,
  supplierId,
  identifier,
  userId
) => {
  try {
    const shipmentStatuses = [
      'intransit',
      'ofd_reverse',
      'completed_delivered',
      'completed_lost',
      'reverse_disposed',
    ];

    for (const status of shipmentStatuses) {
      let cursor = null;
      let filter_cursor = null;
      let pagePointer = null;
      let count = 1;
      let totalPage = 0;
      let allReturnOrder = [];
      while (true) {
        try {
          const returnOrderData = await fetchReturnClaims(
            page,
            supplierId,
            identifier,
            cursor,
            filter_cursor,
            pagePointer,
            status,
            cookie
          );
          if (returnOrderData && returnOrderData.data) {
            allReturnOrder = [...allReturnOrder, ...returnOrderData.data];
            totalPage = returnOrderData.total_pages;
          }
          if (!returnOrderData.cursor || totalPage === count) {
            break;
          }

          cursor = returnOrderData.cursor;
          filter_cursor = returnOrderData.filter_cursor;
          pagePointer = 1;
          count += 1;
        } catch (error) {
          console.log(error);
          break;
        }
      }
      await saveReturnOrdersToDatabase(
        userId,
        allReturnOrder,
        status,
        'return'
      );
    }
  } catch (error) {
    console.log('error:', error);
    return error;
  }
};

const saveReturnOrdersToDatabase = async (
  userId,
  orders,
  status,
  orderType
) => {
  const query = `
  INSERT INTO OMS."meeshoOrders" (
    "userId",
    "orderNumber",
    "productName",
    "productSku",
    "productId",
    "variation",
    "quantity",
    "expected_dispatch_date",
    "slaStatus",
    "status",
    "orderedDate",
    "subOrderNumber",
    "subOrderIdentifier",
    "returnType",
    "returnSubType",
    "shipmentStatus",
    "expectedDeliveryDateISO",
    "lastAttemptedDateISO",
    "carrierName",
    "carrierIdentifier",
    "carrierAccountType",
    "trackingURL",
    "awb",
    "returnPriceType",
    "returnDetailedReason",
    "returnReason",
    "reverseOfdAttemptCountValue",
    "reverseOfdAttemptCountLabel",
    "firstAttemptedDateISO",
    "proofOfDeliveryLabel",
    "displayMsg",
    "otpVerifiedFlag",
    "otpVerifiedTime",
    "digitalPodURL",
    "digitalPodExpiryTime",
    "orderDispatchDateISO",
    "orderDeliveredDateISO",
    "orderType"
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
    $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
    $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34,
    $35, $36, $37, $38
  )
  ON CONFLICT ("orderNumber", "subOrderNumber")
  DO UPDATE SET
    "userId" = EXCLUDED."userId",
    "productName" = EXCLUDED."productName",
    "productSku" = EXCLUDED."productSku",
    "productId" = EXCLUDED."productId",
    "variation" = EXCLUDED."variation",
    "quantity" = EXCLUDED."quantity",
    "expected_dispatch_date" = EXCLUDED."expected_dispatch_date",
    "slaStatus" = EXCLUDED."slaStatus",
    "status" = EXCLUDED."status",
    "orderedDate" = EXCLUDED."orderedDate",
    "subOrderIdentifier" = EXCLUDED."subOrderIdentifier",
    "returnType" = EXCLUDED."returnType",
    "returnSubType" = EXCLUDED."returnSubType",
    "shipmentStatus" = EXCLUDED."shipmentStatus",
    "expectedDeliveryDateISO" = EXCLUDED."expectedDeliveryDateISO",
    "lastAttemptedDateISO" = EXCLUDED."lastAttemptedDateISO",
    "carrierName" = EXCLUDED."carrierName",
    "carrierIdentifier" = EXCLUDED."carrierIdentifier",
    "carrierAccountType" = EXCLUDED."carrierAccountType",
    "trackingURL" = EXCLUDED."trackingURL",
    "awb" = EXCLUDED."awb",
    "returnPriceType" = EXCLUDED."returnPriceType",
    "returnDetailedReason" = EXCLUDED."returnDetailedReason",
    "returnReason" = EXCLUDED."returnReason",
    "reverseOfdAttemptCountValue" = EXCLUDED."reverseOfdAttemptCountValue",
    "reverseOfdAttemptCountLabel" = EXCLUDED."reverseOfdAttemptCountLabel",
    "firstAttemptedDateISO" = EXCLUDED."firstAttemptedDateISO",
    "proofOfDeliveryLabel" = EXCLUDED."proofOfDeliveryLabel",
    "displayMsg" = EXCLUDED."displayMsg",
    "otpVerifiedFlag" = EXCLUDED."otpVerifiedFlag",
    "otpVerifiedTime" = EXCLUDED."otpVerifiedTime",
    "digitalPodURL" = EXCLUDED."digitalPodURL",
    "digitalPodExpiryTime" = EXCLUDED."digitalPodExpiryTime",
    "orderDispatchDateISO" = EXCLUDED."orderDispatchDateISO",
    "orderDeliveredDateISO" = EXCLUDED."orderDeliveredDateISO",
    "orderType" = EXCLUDED."orderType"
`;
  for (const order of orders) {
    const values = [
      userId,
      order.order_num,
      order?.product?.name,
      order?.product.sku,
      order?.product.meesho_pid,
      order?.product.variation,
      order?.product.quantity,
      order?.order_dispatch_date_iso || null,
      order?.shipment_status,
      status,
      order.created_date_iso,
      order.sub_order_num,
      order.sub_order_identifier,
      order.type,
      order.sub_type,
      order.shipment_status,
      order.expected_delivery_date_iso,
      order.last_attempted_date_iso || null,
      order.carrier_name,
      order.carrier_identifier,
      order.carrier_account_type,
      order.tracking_url,
      order.awb,
      order.return_price_type,
      order.return_reason_details?.detailed_reason || null,
      order.return_reason_details?.return_reason || null,
      order.ofd_reverse_attempt?.reverse_ofd_attempt_count_value || null,
      order.ofd_reverse_attempt?.reverse_ofd_attempt_count_label || null,
      order.ofd_reverse_attempt?.first_attempted_date_iso || null,
      order.proof_of_delivery?.label || null,
      order.proof_of_delivery?.display_msg || null,
      order.proof_of_delivery?.otp_verified_flag || null,
      order.proof_of_delivery?.otp_verified_time || null,
      order.proof_of_delivery?.digital_pod_url || null,
      order.proof_of_delivery?.digital_pod_expiry_time || null,
      order.order_dispatch_date_iso,
      order.order_delivered_date_iso,
      orderType,
    ];

    await pool.query(query, values);
  }
};

async function fetchReturnClaims(
  page,
  supplier_supplierId,
  supplier_identifier,
  cursor,
  filter_cursor,
  pagePointer,
  status,
  cookie
) {
  const payload = {
    size: 50,
    page_pointer: pagePointer,
    cursor: cursor,
    filter_cursor: filter_cursor,
    filters: {
      shipment_status: status,
    },
    supplier_details: {
      identifier: supplier_identifier,
      id: supplier_supplierId,
    },
    identifier: supplier_identifier,
    screenType: 'returns',
    cookie,
  };

  if (filter_cursor) delete payload.filters;

  return await retryWithBackoff(() =>
    page.evaluate(async (payload) => {
      try {
        const response = await fetch(
          'https://supplier.meesho.com/fulfillmentapi/api/returnRto/fetchReturnClaims',
          {
            method: 'POST',
            headers: {
              authority: 'supplier.meesho.com',
              accept: 'application/json, text/plain, */*',
              'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
              'browser-id': 'NnMgKyAyMnQgKyAxaGN1MDFoY3Iwbw==',
              'client-type': 'd-web',
              'client-version': 'v1',
              'content-type': 'application/json;charset=UTF-8',
              cookie: payload.cookie,
              identifier: payload.supplier_details.identifier,
            },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Error in fetchReturnClaims page.evaluate:', error);
        throw error;
      }
    }, payload)
  );
}

const loginWithBrowser = async (page, email, password) => {
  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );

    await page.goto('https://supplier.meesho.com/', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await page.click('#loginbutton');
    await page.waitForSelector('input[name="emailOrPhone"]', {
      timeout: 60000,
    });
    await page.type('input[name="emailOrPhone"]', email, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });
    await page.waitForFunction(
      () => !document.querySelector('button[type="submit"]').disabled,
      { timeout: 60000 }
    );
    await page.click('button[type="submit"]');
    await page.waitForNavigation({
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    return page;
  } catch (error) {
    console.error('Error in loginWithBrowser:', error);
    throw error;
  }
};

const fetchOrderPayment = async (
  cookie,
  supplierId,
  identifier,
  date,
  userId,
  status
) => {
  try {
    let offset = 0;
    let allOrderPaymentData = [];
    while (true) {
      const payload = {
        supplier_id: supplierId,
        supplier_identifier: identifier,
        date: date,
        payment_request: {
          offset: offset,
          limit: 20,
          status: status,
        },
        offset,
      };

      const result = await retryWithBackoff(async () => {
        const response = await axios.post(
          'https://supplier.meesho.com/payoutsapi/api/payments/all-ui-data',
          payload,
          {
            headers: {
              authority: 'supplier.meesho.com',
              accept: 'application/json, text/plain, */*',
              'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
              'browser-id': 'NnMgKyAyMnQgKyAxaGN1MDFoY3Iwbw==',
              'client-type': 'd-web',
              'client-version': 'v1',
              'content-type': 'application/json;charset=UTF-8',
              cookie,
              identifier: identifier,
            },
          }
        );

        if (response.status !== 200) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = response.data;
        return {
          isLastPage: data.supplier_payout_response.count - payload.offset <= 0,
          payoutUIList: data.supplier_payout_response.payoutUIList,
        };
      });

      allOrderPaymentData = allOrderPaymentData.concat(result.payoutUIList);
      if (result.isLastPage) {
        break;
      }

      offset += 20;
    }

    if (allOrderPaymentData.length > 0) {
      let saveData = [];
      let updateOrderData = [];
      allOrderPaymentData.map((obj) => {
        saveData.push([
          userId,
          obj.orderNum,
          obj.subOrderNum,
          obj.supplierSKU,
          obj.liveOrderStatus,
          obj.paymentDate,
          obj.amount,
          obj.penalty,
          obj.netAmount,
          obj.returnShippingCharge,
        ]);
        updateOrderData.push([
          userId,
          obj.orderNum,
          obj.subOrderNum,
          obj.supplierSKU,
          obj.liveOrderStatus,
          obj.dispatchDate,
          obj.paymentDate,
          obj.amount,
          obj.penalty,
          obj.netAmount,
          obj.returnShippingCharge,
        ]);
      });

      const insertQuery = format(
        `INSERT INTO oms."meeshoOrdersPayment" (
          "userId", "orderNumber", "subOrderNumber", "productSku", 
          status, "paymentDate", 
          amount, penalty, netamount, returnshippingcharge
        ) 
        VALUES %L
        ON CONFLICT ("orderNumber", "subOrderNumber","paymentDate") 
        DO UPDATE SET
          "userId" = EXCLUDED."userId",
          "productSku" = EXCLUDED."productSku",
          status = EXCLUDED.status,
          amount = EXCLUDED.amount,
          penalty = EXCLUDED.penalty,
          netamount = EXCLUDED.netamount,
          returnshippingcharge = EXCLUDED.returnshippingcharge;`,
        saveData
      );

      const upsertQuery = format(
        `INSERT INTO oms."meeshoOrders" (
            "userId", "orderNumber", "subOrderNumber", "productSku", 
            status, "orderDispatchDateISO", "paymentDate", 
            amount, penalty, netamount, returnshippingcharge
          ) 
          VALUES %L 
          ON CONFLICT ("orderNumber", "subOrderNumber") 
          DO UPDATE SET
            "userId" = EXCLUDED."userId",
            "productSku" = EXCLUDED."productSku",
            status = EXCLUDED.status,
            "orderDispatchDateISO" = EXCLUDED."orderDispatchDateISO",
            "paymentDate" = EXCLUDED."paymentDate",
            amount = EXCLUDED.amount,
            penalty = EXCLUDED.penalty,
            netamount = EXCLUDED.netamount,
            returnshippingcharge = EXCLUDED.returnshippingcharge;`,
        updateOrderData
      );

      const result = await pool.query(upsertQuery);
      const inserted = await pool.query(insertQuery);
      console.log('payment order inserted', updateOrderData.length);
    }
  } catch (error) {
    console.log('Error in fetchOrderPayment:', error);
    throw error;
  }
};

function generateCookies(apiResponse) {
  const cookies = apiResponse.headers['set-cookie'];
  if (!cookies) {
    return '';
  }

  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function callMeeshoLoginAPI(email, password) {
  try {
    const response = await axios.post(
      'https://supplier.meesho.com/v3/api/user/v2-login',
      {
        password: password,
        device_id: email,
        instance: 'Fh0uWwkJhdBpnxTvIgW8s',
        email: email,
      },
      {
        headers: {
          authority: 'supplier.meesho.com',
          accept: 'application/json, text/plain, */*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'browser-id': 'NnMgKyAyMnQgKyAxaGN1MDFoY3Iwbw==',
          'client-type': 'd-web',
          'client-version': 'v1',
          'content-type': 'application/json;charset=UTF-8',
        },
      }
    );

    console.log('Login successful');
    return response;
  } catch (error) {
    console.error('Error making API call:', error);
    throw error;
  }
}

async function fetchOrders(
  cookie,
  identifier,
  supplier_id,
  supplier_name,
  cursor,
  status,
  limit,
  type
) {
  try {
    const payload = {
      enable_hold: true,
      supplier_details: {
        id: supplier_id,
        identifier: identifier,
        name: supplier_name,
      },
      cursor: cursor,
      limit: limit,
      status: status,
      type: type,
      identifier: identifier,
    };

    const response = await axios.post(
      'https://supplier.meesho.com/fulfillmentapi/api/orders',
      payload,
      {
        headers: {
          authority: 'supplier.meesho.com',
          accept: 'application/json, text/plain, */*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'browser-id': 'NnMgKyAyMnQgKyAxaGN1MDFoY3Iwbw==',
          'client-type': 'd-web',
          'client-version': 'v1',
          'content-type': 'application/json;charset=UTF-8',
          cookie,
          identifier: identifier,
        },
      }
    );

    return response.data;
  } catch (error) {
    return error;
  }
}

export { scrapeMeeshoOrders };
