const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidMobileNumber = (mobileNumber) => {
  const mobileNumberRegex = /^\d{10}$/;
  return mobileNumberRegex.test(mobileNumber);
};

const validStatuses = ["Active", "InActive"];

const validRoles = ["ADMIN", "SUB_ADMIN", "MERCHANT", "TRADER", "MANAGER"];

const validStatusesOfWhiteListIp = ["pending", "active", "suspend", "cancel"];

export {
  isValidEmail,
  isValidMobileNumber,
  validStatuses,
  validRoles,
  validStatusesOfWhiteListIp,
};
