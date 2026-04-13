import { getLastCheck, updateLastCheck, enqueueApps } from '../_helpers/updater.js';
import { serve } from '../_helpers/edge.js';
import { processSteamNames } from '../_processors/steam-names.js';
import { processSteamTypes } from '../_processors/steam-types.js';
import { processSteamStoreList } from '../_processors/steam-store-list.js';
import { processSteamPICSChanges } from '../_processors/steam-pics-changes.js';
import { processSteamCards } from '../_processors/steam-cards.js';
import { processSteamRemovals } from '../_processors/steam-removals.js';
import { processSteamPlusOne } from '../_processors/steam-plus-one.js';
import { processGGDealsBundles } from '../_processors/ggdeals-bundles.js';
import { processGGDealsPrices } from '../_processors/ggdeals-prices.js';

// Main handler
const databaseUpdate = async () => {
  const now = new Date().toISOString();

  console.log('1. Processing Steam Names (Secret API)');
  const lastNamesCheck = await getLastCheck('app_names_check');
  const namesResult = await processSteamNames(lastNamesCheck);
  if (namesResult.errors.length > 0) {
    console.error('Error processing Steam names:', namesResult.errors);
  } else {
    await updateLastCheck('app_names_check', now);
  }

  console.log('2. Processing Steam Types (Secret API)');
  const lastTypesCheck = await getLastCheck('app_types_check');
  const typesResult = await processSteamTypes(lastTypesCheck);
  if (typesResult.errors.length > 0) {
    console.error('Error processing Steam types:', typesResult.errors);
  } else {
    await updateLastCheck('app_types_check', now);
  }

  console.log('3. Processing Steam Store List');
  const lastListCheck = await getLastCheck('app_list_check');
  const storeListResult = await processSteamStoreList(lastListCheck);
  if (storeListResult.errors.length > 0) {
    console.error('Error processing Steam Store List:', storeListResult.errors);
  } else {
    await updateLastCheck('app_list_check', now);

    console.log(`Queuing ${storeListResult.successful.length} new apps for update`);
    await enqueueApps(storeListResult.successful.map(app => app.id));
  }

  console.log('4. Processing Steam PICS Changes');
  const lastChangeNumber = await getLastCheck('change_number');
  const picsResult = await processSteamPICSChanges(lastChangeNumber ? parseInt(lastChangeNumber) : 0);
  if (picsResult.errors.length > 0) {
    console.error('Error processing Steam PICS Changes:', picsResult.errors);
  } else {
    await updateLastCheck('change_number', picsResult.currentChangeNumber);
  }

  console.log('5. Processing Steam Cards');
  const lastCardsCheck = await getLastCheck('app_cards_check');
  const cardsResult = await processSteamCards(lastCardsCheck);
  if (cardsResult.errors.length > 0) {
    console.error('Error processing Steam Cards:', cardsResult.errors);
  } else {
    await updateLastCheck('app_cards_check', now);
  }

  console.log('6. Processing Steam Removals');
  const lastRemovalsCheck = await getLastCheck('app_removals_check');
  const removalsResult = await processSteamRemovals(lastRemovalsCheck);
  if (removalsResult.errors.length > 0) {
    console.error('Error processing Steam Removals:', removalsResult.errors);
  } else {
    await updateLastCheck('app_removals_check', now);
  }

  console.log('7. Processing Steam Plus One');
  const plusOneResult = await processSteamPlusOne();
  if (plusOneResult.errors.length > 0) {
    console.error('Error processing Steam Plus One:', plusOneResult.errors);
  }

  console.log('8. Processing GG Deals Bundles');
  const lastBundlesCheck = await getLastCheck('ggdeals_bundles_check');
  const bundlesResult = await processGGDealsBundles(lastBundlesCheck);
  if (bundlesResult.errors.length > 0) {
    console.error('Error processing GG Deals Bundles:', bundlesResult.errors);
  } else {
    await updateLastCheck('ggdeals_bundles_check', now);
  }

  console.log('9. Processing GG Deals Prices');
  const lastPricesCheck = await getLastCheck('ggdeals_deals_check');
  const pricesResult = await processGGDealsPrices(lastPricesCheck);
  if (pricesResult.errors.length > 0) {
    console.error('Error processing GG Deals Prices:', pricesResult.errors);
  } else {
    await updateLastCheck('ggdeals_deals_check', now);
  }

  // Get peak memory usage (if available)
  let peakMemoryMB = null;
  try {
    if (typeof Deno !== 'undefined') {
      // Use Deno's memory info API
      const memoryInfo = Deno.memoryUsage();
      peakMemoryMB = Math.round(memoryInfo.heapUsed / (1024 * 1024));
    }
  } catch (err) {
    console.warn('Unable to measure memory usage:', err.message);
  }

  // Final stats
  const errors = [];
  const failed = [];
  let successful = 0;
  const results = [namesResult, typesResult, storeListResult, picsResult, cardsResult, removalsResult, plusOneResult, bundlesResult, pricesResult];
  results.forEach(result => {
    errors.push(...result.errors);
    failed.push(...result.failed);
    successful += result.successful.length;
  });
  const success = errors.length === 0;
  const message = success
    ? `Successfully processed ${successful} apps`
    : `Encountered ${errors.length} errors and failed to process ${failed.length} apps`;

  return {
    success,
    failed,
    errors,
    timestamp: now,
    duration: new Date().getTime() - new Date(now).getTime(),
    message,
    peakMemoryMB
  };
};

// If in Supabase Edge Functions environment
if (Deno?.env?.get?.('SB_EXECUTION_ID')) {
  // Serve the function
  serve(databaseUpdate, { method: 'GET' });
} else {
  // Run the function directly
  console.log('Database update function initialized');
  databaseUpdate()
    .then(result => {
      console.log('Database update function completed:', result);
    })
    .catch(error => {
      console.error('Error in database update function:', error);
    });
}
