const User = require("../models/User");

const DEFAULT_ADMIN_EMAIL = "admin@license.local";
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin123";

async function ensureDefaultAdmin() {
  let existing = await User.findOne({
    $or: [
      { username: DEFAULT_ADMIN_USERNAME },
      { email: DEFAULT_ADMIN_EMAIL },
    ],
  });

  if (existing && !existing.username) {
    existing.username = DEFAULT_ADMIN_USERNAME;
    if (existing.role !== "admin") existing.role = "admin";
    await existing.save();
    console.log(`Updated existing admin with username: ${DEFAULT_ADMIN_USERNAME}`);
    return;
  }

  if (existing) return;

  await User.create({
    email: DEFAULT_ADMIN_EMAIL,
    username: DEFAULT_ADMIN_USERNAME,
    password: DEFAULT_ADMIN_PASSWORD,
    role: "admin",
    isEnabled: true,
  });
  console.log(
    `Default admin created — username: ${DEFAULT_ADMIN_USERNAME} / password: ${DEFAULT_ADMIN_PASSWORD}`
  );
}

module.exports = { ensureDefaultAdmin };
