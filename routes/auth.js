const Joi = require("@hapi/joi");
const jwt = require("@hapi/jwt");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const { secret, expiresIn, algorithm } = require("../config/jwt");

module.exports = [
  {
    method: "POST",
    path: "/api/auth/signup",
    options: {
      validate: {
        payload: Joi.object({
          email: Joi.string().email().required(),
          password: Joi.string().min(8).required(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const { email, password } = request.payload;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return h.response({ error: "Email already in use" }).code(400);
        }
        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean);
        const role = adminEmails.includes(email.toLowerCase()) ? "admin" : "user";

        const user = await User.create({ email, password, role });

        return {
          id: user._id,
          email: user.email,
          role: user.role,
          isEnabled: user.isEnabled,
        };
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  {
    method: "POST",
    path: "/api/auth/login",
    options: {
      validate: {
        payload: Joi.object({
          email: Joi.string().email().optional(),
          username: Joi.string().optional(),
          password: Joi.string().required(),
        }).or("email", "username"),
      },
    },
    handler: async (request, h) => {
      try {
        const { email, username, password } = request.payload;

        let user;
        if (email) {
          user = await User.findOne({ email }).select("+password");
        } else {
          user = await User.findOne({
            username: username.toLowerCase(),
          }).select("+password");
        }
        if (!user || !(await user.correctPassword(password, user.password))) {
          return h.response({ error: "Incorrect username or password" }).code(401);
        }
        if (!user.isEnabled) {
          return h.response({ error: "Your account is disabled." }).code(403);
        }

        const token = jwt.token.generate(
          {
            aud: "urn:audience:iwt",
            iss: "urn:issuer:iwt",
            sub: user._id,
            email: user.email,
            username: user.username,
            role: user.role,
          },
          {
            key: secret,
            algorithm: algorithm,
          },
          {
            ttlSec: 60 * 60 * 24 * parseInt(expiresIn), // 30 days
          }
        );

        return {
          token,
          user: {
            id: user._id,
            email: user.email,
            username: user.username,
            role: user.role,
            isEnabled: user.isEnabled,
          },
        };
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/auth/me",
    options: {
      auth: "jwt",
    },
    handler: async (request, h) => {
      try {
        const userId = request.auth.credentials.sub;
        console.log("userId", userId);
        const user = await User.findById(userId).select("-password");

        if (!user) {
          return h.response({ error: "User not found" }).code(404);
        }
        if (!user.isEnabled) {
          return h.response({ error: "User account is disabled" }).code(403);
        }

        return user;
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },

  {
    method: "POST",
    path: "/api/contact",
    options: {
      validate: {
        payload: Joi.object({
          name: Joi.string().required(),
          email: Joi.string().email().required(),
          subject: Joi.string().required(),
          text: Joi.string().required(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const { name, email, subject, text } = request.payload;
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });
        const mailOptions = {
          from: email,
          to: process.env.EMAIL_USER,
          subject: `New Message: ${subject}`,
          text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${text}`,
        };
        await transporter.sendMail(mailOptions);
        return h.response({ message: "Email sent successfully" }).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
];
