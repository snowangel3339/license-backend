module.exports = {
  secret: process.env.JWT_SECRET || "your_jwt_secret_here",
  expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  algorithm: "HS256",
};
