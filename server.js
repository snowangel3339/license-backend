const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const Hapi = require("@hapi/hapi");
const jwt = require("@hapi/jwt");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const licenseRoutes = require("./routes/licenses");
const transactionRoutes = require("./routes/transaction");
const adminRoutes = require("./routes/admin");
const portalRoutes = require("./routes/portal");
const publicLicenseRoutes = require("./routes/publicLicense");
const { secret, algorithm } = require("./config/jwt");
const User = require("./models/User");
const { ensureDefaultAdmin } = require("./lib/ensureDefaultAdmin");

const init = async () => {
  await connectDB();
  await ensureDefaultAdmin();

  // With credentials enabled, the CORS spec forbids a wildcard origin, so we
  // reflect an explicit allow-list. Set CORS_ORIGINS in .env (comma-separated).
  const allowedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const server = Hapi.server({
    port: process.env.PORT || 3000,
    host: "0.0.0.0",
    routes: {
      cors: {
        origin: allowedOrigins.length ? allowedOrigins : ["*"],
        headers: ["Accept", "Authorization", "Content-Type", "If-None-Match"],
        additionalHeaders: ["X-Requested-With"],
        credentials: true,
        exposedHeaders: ["WWW-Authenticate", "Server-Authorization"],
        maxAge: 60,
      },
    },
  });

  await server.register(jwt);

  server.auth.strategy("jwt", "jwt", {
    keys: secret,
    verify: {
      aud: "urn:audience:iwt",
      iss: "urn:issuer:iwt",
      sub: false,
      nbf: true,
      exp: true,
      maxAgeSec: 60 * 60 * 24 * 30,
      timeSkewSec: 15,
    },
    validate: async (artifacts, request, h) => {
      try {
        const user = await User.findById(artifacts.decoded.payload.sub);
        if (!user || !user.isEnabled) {
          return { isValid: false };
        }
        return {
          isValid: true,
          credentials: {
            sub: user._id.toString(),
            email: user.email,
            username: user.username,
            role: user.role,
            scope: [user.role],
            isEnabled: user.isEnabled,
          },
        };
      } catch (error) {
        console.error("JWT validation error:", error);
        return { isValid: false };
      }
    },
  });


  server.route([
    ...authRoutes,
    ...licenseRoutes,
    ...publicLicenseRoutes,
    ...portalRoutes,
    ...adminRoutes,
    ...transactionRoutes,
  ]);

  server.route({
    method: "GET",
    path: "/protected",
    options: {
      auth: "jwt",
    },
    handler: (request, h) => {
      return {
        message: "You accessed a protected route!",
        user: request.auth.credentials,
      };
    },
  });

  await server.start();
  console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", (err) => {
  console.log(err);
  process.exit(1);
});

init();
