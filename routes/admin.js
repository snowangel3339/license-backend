const Joi = require("@hapi/joi");
const moment = require("moment");
const License = require("../models/License");
const User = require("../models/User");

module.exports = [
  {
    method: "GET",
    path: "/api/admin/users",
    options: {
      auth: {
        strategy: "jwt",
        scope: ["admin"],
      },
    },
    handler: async (request, h) => {
      try {
        const users = await User.find().select("-password");
        return users;
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  {
    method: "PUT",
    path: "/api/admin/users/{userId}/status",
    options: {
      auth: {
        strategy: "jwt",
        scope: ["admin"],
      },
      validate: {
        params: Joi.object({
          userId: Joi.string().required(),
        }),
        payload: Joi.object({
          isEnabled: Joi.boolean().required(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const { userId } = request.params;
        const { isEnabled } = request.payload;

        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { isEnabled },
          { new: true }
        ).select("-password");

        if (!updatedUser) {
          return h.response({ error: "User not found" }).code(404);
        }

        return h.response(updatedUser).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  {
    method: "PUT",
    path: "/api/admin/users/{userId}/role",
    options: {
      auth: {
        strategy: "jwt",
        scope: ["admin"],
      },
      validate: {
        params: Joi.object({
          userId: Joi.string().required(),
        }),
        payload: Joi.object({
          role: Joi.string().valid("user", "admin").required(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const { userId } = request.params;
        const { role } = request.payload;

        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { role },
          { new: true }
        ).select("-password");

        if (!updatedUser) {
          return h.response({ error: "User not found" }).code(404);
        }

        return h.response(updatedUser).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  {
    method: "GET",
    path: "/api/admin/stats",
    options: {
      auth: {
        strategy: "jwt",
        scope: ["admin"],
      },
    },
    handler: async (request, h) => {
      try {
        const totalUsers = await User.countDocuments();
        const totalLicenses = await License.countDocuments();
        const activeLicenses = await License.countDocuments({
          status: "active",
        });

        const soonToExpire = await License.find({
          status: "active",
          expiresAt: {
            $lte: moment().add(7, "days").toDate(),
            $gte: moment().toDate(),
          },
        }).countDocuments();

        return {
          totalUsers,
          totalLicenses,
          activeLicenses,
          soonToExpire,
        };
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  {
    method: "GET",
    path: "/api/admin/licenses",
    options: {
      auth: {
        strategy: "jwt",
        scope: ["admin"],
      },
      validate: {
        query: Joi.object({
          status: Joi.string()
            .valid("active", "expired", "suspended", "paused")
            .optional(),
          limit: Joi.number().integer().min(1).max(100).default(10),
          page: Joi.number().integer().min(1).default(1),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const { status, limit, page } = request.query;
        const skip = (page - 1) * limit;

        const query = {};
        if (status) query.status = status;

        const licenses = await License.find(query)
          .skip(skip)
          .limit(limit)
          .sort("-createdAt");

        const total = await License.countDocuments(query);

        return {
          licenses,
          total,
          page,
          pages: Math.ceil(total / limit),
        };
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
];
