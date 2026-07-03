/** License plan durations (days). Used when creating licenses without Stripe. */
module.exports = {
  plans: {
    monthly: { duration: 30 },
    yearly: { duration: 365 },
    three_year: { duration: 1095 },
    lifetime: { duration: 3650 },
  },
};
