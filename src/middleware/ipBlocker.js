const blockedIps = new Set();

const blockIps = (req, res, next) => {
  const ip =
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;
  if (blockedIps.has(ip)) {
    return res.status(403).json({ message: 'Your IP is blocked' });
  }
  next();
};

export { blockIps, blockedIps };
