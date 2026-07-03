/**
 * Validates account id + lookup result for portal-style flows (active license from admin DB).
 * @returns {{ ok: true } | { ok: false, statusCode: number, message: string }}
 */
function validateLicenseForPortalLink(license, accountIdTrim) {
  if (!license) {
    return {
      ok: false,
      statusCode: 404,
      message:
        "No license matches this key. Ask your administrator to create your license.",
    };
  }

  if (license.mt5UserId !== accountIdTrim) {
    return {
      ok: false,
      statusCode: 404,
      message: "Account number does not match this license key.",
    };
  }

  const now = new Date();
  const pastExpiry =
    license.expiresAt != null && now > new Date(license.expiresAt);
  if (license.status === "expired" || pastExpiry) {
    return {
      ok: false,
      statusCode: 401,
      message: "License is expired.",
    };
  }

  if (license.status === "suspended" || license.status === "paused") {
    return {
      ok: false,
      statusCode: 403,
      message:
        license.status === "suspended"
          ? "License is suspended."
          : "License is paused.",
    };
  }

  return { ok: true };
}

module.exports = { validateLicenseForPortalLink };
