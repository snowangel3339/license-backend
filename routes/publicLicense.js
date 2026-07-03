/**
 * Public routes (no JWT): callers prove possession with mt5UserId + licenseKey.
 */
const Joi = require("@hapi/joi");
const License = require("../models/License");
const {
  validateLicenseForPortalLink,
} = require("../lib/validateLicensePortalPair");

module.exports = [
  {
    method: "POST",
    path: "/api/public/license/verify",
    options: {
      validate: {
        payload: Joi.object({
          mt5UserId: Joi.string().required(),
          licenseKey: Joi.string().required(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const accountIdTrim = String(request.payload.mt5UserId).trim();
        const licenseKeyTrim = request.payload.licenseKey.trim();

        const license = await License.findOne({ key: licenseKeyTrim }).lean();
        const chk = validateLicenseForPortalLink(license, accountIdTrim);
        if (!chk.ok) {
          return h.response({ error: chk.message }).code(chk.statusCode);
        }

        return h.response({ license }).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  {
    method: "PATCH",
    path: "/api/public/license/autotrade",
    options: {
      validate: {
        payload: Joi.object({
          mt5UserId: Joi.string().required(),
          licenseKey: Joi.string().required(),
          autoTradeEnabled: Joi.boolean().required(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const accountIdTrim = String(request.payload.mt5UserId).trim();
        const licenseKeyTrim = request.payload.licenseKey.trim();
        const { autoTradeEnabled } = request.payload;

        let license = await License.findOne({ key: licenseKeyTrim });
        const chk = validateLicenseForPortalLink(license, accountIdTrim);
        if (!chk.ok) {
          return h.response({ error: chk.message }).code(chk.statusCode);
        }

        license.autoTradeEnabled = autoTradeEnabled;
        await license.save();

        const fresh = await License.findById(license._id).lean();
        return h.response({ license: fresh }).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
];
