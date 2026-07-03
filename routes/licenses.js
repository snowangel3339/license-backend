const Joi = require("@hapi/joi");
const jwt = require("@hapi/jwt");
const moment = require("moment");
const License = require("../models/License");
const User = require("../models/User");

module.exports = [
  {
    method: "GET",
    path: "/api/licenses",
    options: {
      auth: "jwt",
    },
    handler: async (request, h) => {
      try {
        const licenses = await License.find({}).sort("-createdAt");
        return h.response(licenses).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  {
    method: "POST",
    path: "/api/licenses",
    options: {
      auth: "jwt",
      validate: {
        payload: Joi.object({
          mt5UserId: Joi.string().required(),
          tradingPlatform: Joi.string().valid("mt4", "mt5").required(),
          brokerName: Joi.string().allow("").optional(),
          plan: Joi.string()
            .valid("monthly", "yearly", "three_year", "lifetime")
            .optional(),
          isPerpetual: Joi.boolean().optional(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const {
          mt5UserId,
          brokerName,
          tradingPlatform,
          plan,
          isPerpetual,
        } = request.payload;
        const userId = request.auth.credentials.sub;

        const user = await User.findById(userId);
        if (!user) {
          return h.response({ error: "User not found" }).code(404);
        }

        const licenseKey = generateLicenseKey();
        const planKey = isPerpetual ? "lifetime" : plan || "yearly";

        const license = await License.create({
          key: licenseKey,
          mt5UserId,
          brokerName: brokerName || "",
          tradingPlatform,
          plan: planKey,
          expiresAt: isPerpetual ? null : calculateExpirationDate(planKey),
        });

        return h.response(license).code(201);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  {
    method: "PUT",
    path: "/api/licenses/{licenseId}",
    options: {
      auth: "jwt",
      validate: {
        params: Joi.object({
          licenseId: Joi.string().required(),
        }),
        payload: Joi.object({
          status: Joi.string()
            .valid("active", "expired", "suspended", "paused")
            .optional(),
          expiresAt: Joi.date().allow(null).optional(),
          isPerpetual: Joi.boolean().optional(),
          brokerName: Joi.string().allow("").optional(),
          tradingPlatform: Joi.string().valid("mt4", "mt5").optional(),
          autoTradeEnabled: Joi.boolean().optional(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const { licenseId } = request.params;
        const status = request.payload.status;
        const expiresAt = request.payload.expiresAt;
        const isPerpetual = request.payload.isPerpetual;
        const brokerName = request.payload.brokerName;
        const tradingPlatform = request.payload.tradingPlatform;
        const autoTradeEnabled = request.payload.autoTradeEnabled;

        const license = await License.findById(licenseId);
        if (!license) {
          return h.response({ error: "License not found" }).code(404);
        }

        let expiresAtDate;
        if (isPerpetual === true) {
          expiresAtDate = null;
        } else if (isPerpetual === false) {
          expiresAtDate =
            expiresAt != null ? expiresAt : license.expiresAt;
        }

        const updates = {};
        if (status !== undefined) updates.status = status;
        if (expiresAtDate !== undefined) updates.expiresAt = expiresAtDate;
        if (brokerName !== undefined) updates.brokerName = brokerName;
        if (tradingPlatform !== undefined) updates.tradingPlatform = tradingPlatform;
        if (autoTradeEnabled !== undefined)
          updates.autoTradeEnabled = autoTradeEnabled;

        const updatedLicense = await License.findByIdAndUpdate(
          licenseId,
          { $set: updates },
          { new: true }
        );
        return h.response(updatedLicense).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  {
    method: "DELETE",
    path: "/api/licenses/{licenseId}",
    options: {
      auth: "jwt",
      validate: {
        params: Joi.object({
          licenseId: Joi.string().required(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const { licenseId } = request.params;

        const license = await License.findById(licenseId);
        if (!license) {
          return h.response({ error: "License not found" }).code(404);
        }

        await License.findByIdAndDelete(licenseId);
        return { success: true };
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },

  {
    method: "POST",
    path: "/api/licenses/check",
    options: {
      validate: {
        payload: Joi.object({
          accountId: Joi.string().required(),
          platform: Joi.string().valid("mt4", "mt5").required(),
          licenseKey: Joi.string().required(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const { accountId, platform, licenseKey } = request.payload;

        const license = await License.findOne({ key: licenseKey.trim() });

        if (!license) {
          return h
            .response({ error: "License key does not exist." })
            .code(402);
        }

        if (license.mt5UserId !== String(accountId).trim()) {
          return h.response({ error: "Cannot find account." }).code(404);
        }

        if (license.tradingPlatform !== platform) {
          return h
            .response({
              error: "Trading platform does not match this license.",
            })
            .code(400);
        }

        const now = new Date();
        const pastExpiry =
          license.expiresAt != null && now > new Date(license.expiresAt);
        if (license.status === "expired" || pastExpiry) {
          return h.response({ error: "License is expired." }).code(401);
        }

        if (license.status === "suspended" || license.status === "paused") {
          return h
            .response({ error: `License is ${license.status}.` })
            .code(403);
        }

        return h
          .response({
            valid: true,
            accountId: license.mt5UserId,
            platform: license.tradingPlatform,
          })
          .code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  {
    method: "POST",
    path: "/api/licenses/check-autotrade",
    options: {
      validate: {
        payload: Joi.object({
          accountId: Joi.string().required(),
          platform: Joi.string().valid("mt4", "mt5").required(),
          licenseKey: Joi.string().required(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const { accountId, platform, licenseKey } = request.payload;

        const license = await License.findOne({ key: licenseKey.trim() });

        if (!license) {
          return h
            .response({ error: "License key does not exist." })
            .code(402);
        }

        if (license.mt5UserId !== String(accountId).trim()) {
          return h.response({ error: "Cannot find account." }).code(404);
        }

        if (license.tradingPlatform !== platform) {
          return h
            .response({
              error: "Trading platform does not match this license.",
            })
            .code(400);
        }

        const now = new Date();
        const pastExpiry =
          license.expiresAt != null && now > new Date(license.expiresAt);
        if (license.status === "expired" || pastExpiry) {
          return h.response({ error: "License is expired." }).code(401);
        }

        if (license.status === "suspended" || license.status === "paused") {
          return h
            .response({ error: `License is ${license.status}.` })
            .code(403);
        }

        const on = license.autoTradeEnabled !== false;

        return h.response({ autoTrade: on ? 1 : 0 }).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  {
    method: "POST",
    path: "/api/licenses/validate",
    options: {
      validate: {
        payload: Joi.object({
          mt5UserId: Joi.string().required(),
          licenseKey: Joi.string().required(),
          tradingPlatform: Joi.string().valid("mt4", "mt5").required(),
          brokerName: Joi.string().allow("").optional(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const { mt5UserId, licenseKey, tradingPlatform, brokerName } =
          request.payload;

        const license = await License.findOne({ key: licenseKey, mt5UserId });

        if (!license) {
          return h.response({ valid: false, reason: "not_found" }).code(200);
        }

        if (license.tradingPlatform !== tradingPlatform) {
          return h
            .response({
              valid: false,
              reason: "platform_mismatch",
            })
            .code(200);
        }

        if (
          brokerName &&
          license.brokerName &&
          license.brokerName !== brokerName
        ) {
          return h
            .response({
              valid: false,
              reason: "broker_mismatch",
            })
            .code(200);
        }

        if (license.status === "suspended") {
          return h
            .response({
              valid: false,
              reason: "suspended",
              allowManageOpenTrades: false,
              disableWhenNoOpenTrades: true,
            })
            .code(200);
        }

        if (license.status === "paused") {
          return h
            .response({
              valid: false,
              reason: "paused",
              allowManageOpenTrades: true,
              disableWhenNoOpenTrades: false,
            })
            .code(200);
        }

        if (
          license.status === "expired" ||
          (license.expiresAt && new Date() > license.expiresAt)
        ) {
          return h
            .response({
              valid: false,
              reason: "expired",
              allowManageOpenTrades: true,
              disableWhenNoOpenTrades: true,
            })
            .code(200);
        }

        return h.response({ valid: true, reason: "active" }).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  {
    method: "POST",
    path: "/api/free-trial",
    options: {
      validate: {
        payload: Joi.object({
          mt5UserId: Joi.string().required(),
          tradingPlatform: Joi.string().valid("mt4", "mt5").default("mt5"),
          brokerName: Joi.string().allow("").optional(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const { mt5UserId, brokerName, tradingPlatform } = request.payload;

        const existingLicense = await License.findOne({ mt5UserId });
        if (existingLicense) {
          return h
            .response({ error: "Free trial already used for this account." })
            .code(400);
        }

        const license = await License.create({
          key: generateLicenseKey(),
          mt5UserId,
          brokerName: brokerName || "",
          tradingPlatform,
          plan: "monthly",
          expiresAt: moment().add(30, "days").toDate(),
        });

        return h.response({ license_key: license.key }).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  {
    method: "POST",
    path: "/api/licenses/personal",
    options: {
      validate: {
        payload: Joi.object({
          mt5UserId: Joi.string().required(),
        }),
      },
    },
    handler: async (request, h) => {
      const { mt5UserId } = request.payload;
      const MAX_RETRIES = 30;
      const RETRY_INTERVAL = 1000;

      try {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          const license = await License.findOne({ mt5UserId });

          if (license) {
            console.log(
              `License found for user ${mt5UserId} after ${attempt} seconds`
            );
            return h.response({ license_key: license.key }).code(200);
          }

          if (attempt < MAX_RETRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
          }
        }

        console.log(
          `License not created for user ${mt5UserId} after ${MAX_RETRIES} seconds`
        );
        return h
          .response({ error: "License not created after waiting period" })
          .code(404);
      } catch (err) {
        console.error("Error while fetching license:", err.message);
        return h.response({ error: err.message }).code(500);
      }
    },
  },
];

function generateLicenseKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
    if ((i + 1) % 4 === 0 && i !== 15) result += "-";
  }
  return result;
}

function calculateExpirationDate(plan) {
  const { plans } = require("../config/plans");
  const p = plans[plan];
  if (!p) {
    return moment().add(plans.monthly.duration, "days").toDate();
  }
  return moment().add(p.duration, "days").toDate();
}
