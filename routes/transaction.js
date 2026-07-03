const Joi = require("@hapi/joi");
const Transaction = require("../models/Transaction");

module.exports = [
  {
    method: "GET",
    path: "/api/transactions",
    options: {
      auth: "jwt",
    },
    handler: async (request, h) => {
      try {
        const transactions = await Transaction.find({}).sort("-createdAt");
        return h.response(transactions).code(200);
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
  
  
  {
    method: "DELETE",
    path: "/api/transactions/{transactionId}",
    options: {
      auth: "jwt",
      validate: {
        params: Joi.object({
          transactionId: Joi.string().required(),
        }),
      },
    },
    handler: async (request, h) => {
      try {
        const { transactionId } = request.params;

        const transaction = await Transaction.findById(transactionId);
        if (!transaction) {
          return h.response({ error: "Transaction not found" }).code(404);
        }

        await Transaction.findByIdAndDelete(transactionId);
        return { success: true };
      } catch (err) {
        return h.response({ error: err.message }).code(500);
      }
    },
  },
];
