import { serve } from '../_helpers/edge.js';
import { processSteamPICS } from '../_processors/steam-pics.js';
import { processSteamStoreDetails } from '../_processors/steam-store-details.js';
import { processSteamReviews } from '../_processors/steam-reviews.js';
import { processGGDealsDetails } from '../_processors/ggdeals-details.js';
import { dequeueApps } from '../_helpers/updater.js';

// Runs every 5 minutes
const appUpdate = async ({ count = 100 } = {}) => {
  const appids = await dequeueApps(count);

  if (appids.length === 0) {
    return { success: true, message: 'No apps to update' };
  }

  if (appids.length > 200) {
    return { success: false, message: 'Too many apps to update. Try lowering the count.' };
  }

  const steamPICSResult = await processSteamPICS(appids);
  const steamStoreDetailsResult = await processSteamStoreDetails(appids);
  const steamReviewsResult = await processSteamReviews(appids);
  const ggdealsDetailsResult = await processGGDealsDetails(appids);

  const errorCount = steamPICSResult.errors.length + steamStoreDetailsResult.errors.length + steamReviewsResult.errors.length + ggdealsDetailsResult.errors.length;
  const failedCount = steamPICSResult.failed.length + steamStoreDetailsResult.failed.length + steamReviewsResult.failed.length + ggdealsDetailsResult.failed.length;
  const success = errorCount === 0;
  const message = success ? 'Apps updated successfully' : `Encountered ${errorCount} errors and failed to process ${failedCount} of ${appids.length * 4} apps`;

  // Detailed error and failure reporting
  const details = {};
  if (!success) {
    if (steamPICSResult.errors.length > 0 || steamPICSResult.failed.length > 0) {
      details.steamPICS = {
        errors: steamPICSResult.errors.map(error => error.message),
        failed: steamPICSResult.failed
      };
    }

    if (steamStoreDetailsResult.errors.length > 0 || steamStoreDetailsResult.failed.length > 0) {
      details.steamStoreDetails = {
        errors: steamStoreDetailsResult.errors.map(error => error.message),
        failed: steamStoreDetailsResult.failed
      };
    }

    if (steamReviewsResult.errors.length > 0 || steamReviewsResult.failed.length > 0) {
      details.steamReviews = {
        errors: steamReviewsResult.errors.map(error => error.message),
        failed: steamReviewsResult.failed
      };
    }

    if (ggdealsDetailsResult.errors.length > 0 || ggdealsDetailsResult.failed.length > 0) {
      details.ggdealsDetails = {
        errors: ggdealsDetailsResult.errors.map(error => error.message),
        failed: ggdealsDetailsResult.failed
      };
    }
  }

  return {
    success,
    message,
    timestamp: new Date().toISOString(),
    ...(Object.keys(details).length > 0 && { details })
  };
};

// If in Supabase Edge Functions environment
if (Deno?.env?.get?.('SB_EXECUTION_ID')) {
  // Serve the function
  serve(appUpdate);
} else {
  // Run the function directly
  console.log('App update function initialized');
  appUpdate()
    .then((result) => {
      console.log('App update function completed:', result);
    })
    .catch((error) => {
      console.error('Error in app update function:', error);
    });
}
