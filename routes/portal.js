/**
 * Customer portal API: link licenses issued by admins, manage auto-trade per license.
 */
const Joi = require("@hapi/joi");
const mongoose = require("mongoose");
const License = require("../models/License");
const {
  validateLicenseForPortalLink,
} = require("../lib/validateLicensePortalPair");

function portalAuthorized(credentials) {
  return credentials && ["user", "admin"].includes(credentials.role);
}

module.exports = [
  {
    method: "GET",
    path: "/api/portal/licenses",
    options: {
      auth: "jwt",
    },
    handler: async (request, h) => {
      try {
        if (!portalAuthorized(request.auth.credentials)) {
          return h.response({ error: "Forbidden" }).code(403);
        }

        const userId = request.auth.credentials.sub;
        const list = await License.find({ linkedUserId: userId })
          .sort("-createdAt")
          .lean();

        return h.response(list).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },

  {
    method: "POST",
    path: "/api/portal/licenses/link",
    options: {
      auth: "jwt",
      validate: {
        payload: Joi.object({
          mt5UserId: Joi.string().required(),
          licenseKey: Joi.string().required(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        if (!portalAuthorized(request.auth.credentials)) {
          return h.response({ error: "Forbidden" }).code(403);
        }

        const userId = request.auth.credentials.sub;
        const accountIdTrim = String(request.payload.mt5UserId).trim();
        const licenseKeyTrim = request.payload.licenseKey.trim();

        const license = await License.findOne({ key: licenseKeyTrim });
        const chk = validateLicenseForPortalLink(license, accountIdTrim);
        if (!chk.ok) {
          return h.response({ error: chk.message }).code(chk.statusCode);
        }

        if (license.linkedUserId?.toString() === userId.toString()) {
          const freshSame = await License.findById(license._id).lean();
          return h.response(freshSame).code(200);
        }

        if (
          license.linkedUserId &&
          license.linkedUserId.toString() !== userId.toString()
        ) {
          return h
            .response({
              error:
                "This license is already linked to a different portal account.",
            })
            .code(409);
        }

        license.linkedUserId = new mongoose.Types.ObjectId(userId);
        license.autoTradeEnabled = true;
        await license.save();

        const fresh = await License.findById(license._id).lean();
        return h.response(fresh).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },

  {
    method: "PATCH",
    path: "/api/portal/licenses/{licenseId}/autotrade",
    options: {
      auth: "jwt",
      validate: {
        params: Joi.object({
          licenseId: Joi.string().required(),
        }),
        payload: Joi.object({
          autoTradeEnabled: Joi.boolean().required(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        if (!portalAuthorized(request.auth.credentials)) {
          return h.response({ error: "Forbidden" }).code(403);
        }

        const userId = request.auth.credentials.sub;
        const role = request.auth.credentials.role;
        const { licenseId } = request.params;
        const { autoTradeEnabled } = request.payload;

        const license = await License.findById(licenseId);
        if (!license) {
          return h.response({ error: "License not found" }).code(404);
        }

        const isOwner =
          license.linkedUserId &&
          license.linkedUserId.toString() === userId.toString();
        const isAdmin = role === "admin";

        if (!isOwner && !isAdmin) {
          return h.response({ error: "Forbidden" }).code(403);
        }

        license.autoTradeEnabled = autoTradeEnabled;
        await license.save();

        const fresh = await License.findById(licenseId).lean();
        return h.response(fresh).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },

  {
    method: "DELETE",
    path: "/api/portal/licenses/{licenseId}/link",
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
        if (!portalAuthorized(request.auth.credentials)) {
          return h.response({ error: "Forbidden" }).code(403);
        }

        const userId = request.auth.credentials.sub;
        const { licenseId } = request.params;

        const license = await License.findById(licenseId);
        if (!license) {
          return h.response({ error: "License not found" }).code(404);
        }

        if (
          !license.linkedUserId ||
          license.linkedUserId.toString() !== userId.toString()
        ) {
          return h.response({ error: "Forbidden" }).code(403);
        }

        license.linkedUserId = null;
        await license.save();

        return h.response({ success: true }).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
];
