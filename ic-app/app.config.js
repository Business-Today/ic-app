/**
 * Loads app.json and, only when IC_LOCAL_BUNDLE_ID is set, swaps the iOS
 * bundle identifier / Android package for a dev-only one.
 *
 * Why: the production ID (org.businesstoday.ic) is registered to Business
 * Today's Apple team. A developer building locally with their own paid Apple
 * account cannot sign that ID, and Xcode falls back to a wildcard profile that
 * cannot carry NFC or push entitlements. A unique dev ID on your own team
 * gets those capabilities automatically.
 *
 *   IC_LOCAL_BUNDLE_ID=org.businesstoday.ic.dev npx expo prebuild -p ios --clean
 *   IC_LOCAL_BUNDLE_ID=org.businesstoday.ic.dev npx expo run:ios --device
 *
 * Leave the variable unset for EAS and production builds.
 */
module.exports = ({ config }) => {
  const localId = process.env.IC_LOCAL_BUNDLE_ID;
  if (!localId) return config;

  return {
    ...config,
    ios: {
      ...config.ios,
      bundleIdentifier: localId,
      ...(process.env.IC_APPLE_TEAM_ID ? { appleTeamId: process.env.IC_APPLE_TEAM_ID } : {}),
    },
    android: { ...config.android, package: localId },
  };
};
