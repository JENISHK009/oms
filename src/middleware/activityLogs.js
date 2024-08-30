import { pool } from '../config/index.js';

const logRequestAndResponse = async (req, res, next) => {
  const userId = req.currentUser ? req.currentUser.id : null;
  const userName = req.currentUser ? req.currentUser.name : null;
  const requestPayload = {
    body: req.body,
    query: req.query,
    params: req.params,
  };
  const fullUrl = req.originalUrl;
  const endpoint = fullUrl.split('/').pop().split('?')[0];

  let logId = null;

  try {
    const log = {
      userId,
      userName,
      requestTime: new Date(),
      requestPayload: JSON.stringify(requestPayload),
      responsePayload: null,
      apiUrl: endpoint,
    };

    const logQuery = `
      INSERT INTO OMS."sellerActivityLogs" ("userId", "userName", "requestTime", "requestPayload", "apiUrl")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id;
    `;
    const logValues = [
      log.userId,
      log.userName,
      log.requestTime,
      log.requestPayload,
      log.apiUrl,
    ];
    const logResult = await pool.query(logQuery, logValues);
    logId = logResult.rows[0].id;

    const originalSend = res.send;

    res.send = function (body) {
      log.responsePayload = body;

      if (logId) {
        const updateLogQuery = `
          UPDATE OMS."sellerActivityLogs"
          SET "responsePayload" = $1
          WHERE id = $2;
        `;
        pool
          .query(updateLogQuery, [log.responsePayload, logId])
          .catch((error) => {
            console.error('Error updating log entry:', error);
          });
      }

      originalSend.call(this, body);
    };
  } catch (error) {
    console.error('Error logging request:', error);
  }

  next();
};

export { logRequestAndResponse };
