import gplay from "google-play-scraper";

/**
 * @typedef {Object} PlayStoreData
 * @property {string|null} description
 * @property {string|null} icon
 * @property {string[]} screenshots
 * @property {string|null} category
 * @property {string[]} reviews
 */

/**
 * Fetch app metadata + top reviews from the Play Store.
 * Returns null if the app isn't found (iOS-only, wrong package ID, etc.)
 *
 * @param {string} appPackageId
 * @param {number} reviewCount
 * @returns {Promise<PlayStoreData|null>}
 */
export async function scrapeApp(appPackageId, reviewCount = 50) {
  let appData;
  try {
    appData = await gplay.app({ appId: appPackageId, lang: "en", country: "us" });
  } catch (err) {
    if (err.message?.includes("404") || err.message?.includes("not found")) {
      return null;
    }
    throw err;
  }

  let reviews = [];
  try {
    const { data } = await gplay.reviews({
      appId: appPackageId,
      num: reviewCount,
      sort: gplay.sort.HELPFULNESS,
      lang: "en",
      country: "us",
    });
    reviews = data.map((r) => r.text).filter(Boolean);
  } catch {
    // Reviews are optional — carry on without them
  }

  const rawScreenshots = Array.isArray(appData.screenshots) ? appData.screenshots : [];
  const screenshots = [...new Set(rawScreenshots)]; // deduplicate (API returns size variants)

  return {
    description: appData.description ?? null,
    icon: appData.icon ?? null,
    screenshots,
    category: appData.genre ?? null,
    reviews,
  };
}
