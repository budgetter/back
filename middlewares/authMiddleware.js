const jwt = require("jsonwebtoken");
require("dotenv").config();

const authenticateToken = (req, res, next) => {
  // Expecting header: Authorization: Bearer <token>
  // Also supports ?token= query param for OAuth redirect flows
  const authHeader = req.headers["authorization"];
  const token = (authHeader && authHeader.split(" ")[1]) || req.query.token;
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({ message: "Token is invalid or expired" });
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken };
