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
    // Any error here means we can't get Play Store data — return null so the
    // pipeline enriches with AI only (no crash). Log the real reason for debugging.
    console.warn(`\n    [scraper] ${appPackageId}: ${err.message}`);
    return null;
  }

  let reviews = [];
  try {
    const result = await gplay.reviews({
      appId: appPackageId,
      num: reviewCount,
      sort: gplay.sort.HELPFULNESS,
      lang: "en",
      country: "us",
    });
    const data = Array.isArray(result?.data) ? result.data : [];
    reviews = data.map((r) => r?.text).filter(Boolean);
  } catch {
    // Reviews are optional — carry on without them
  }

  const rawScreenshots = Array.isArray(appData.screenshots) ? appData.screenshots : [];
  // Deduplicate by exact URL, then cap at 8.
  // The API returns phone/tablet/landscape variants as separate URLs — 20-30+ total is common.
  const screenshots = [...new Set(rawScreenshots)].slice(0, 8);

  return {
    description: appData.description ?? null,
    icon: appData.icon ?? null,
    screenshots,
    category: appData.genre ?? null,
    reviews,
  };
}
