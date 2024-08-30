const sendResponse = (res, statusCode, message, data = null) => {
  res.status(statusCode).json({
    message,
    data,
  });
};

const sendSuccess = (res, message, data = null) => {
  sendResponse(res, 200, message, data);
};

const sendError = (res, message, statusCode = 500) => {
  sendResponse(res, statusCode, message, null);
};

export { sendSuccess, sendError };
