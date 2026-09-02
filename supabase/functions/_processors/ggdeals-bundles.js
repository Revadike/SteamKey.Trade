import { Collection } from '../_entities/index.js';
import { saveToDatabase } from '../_helpers/updater.js';

/**
 * Processes a list of bundles from the GG Deals API and saves the processed data to a database.
 *
 * @param {string} lastCheck - The timestamp of the last check to filter bundles.
 * @returns {Promise<Object>} A promise that resolves to an object containing the results:
 * - `errors`: An array of errors encountered during processing.
 * - `failed`: An array of records that failed to process.
 * - `successful`: An array of successfully processed records.
 */
export const processGGDealsBundles = async (lastCheck) => {
  try {
    const allBundles = [];
    const initialUrl = new URL('https://api.gg.deals/steamkeytrade/bundle/index/');

    if (lastCheck) {
      initialUrl.searchParams.append('since', Math.floor(new Date(lastCheck).getTime() / 1000).toString());
    }

    // Process all pages until next is null
    let currentUrl = initialUrl.toString();

    do {
      const response = await fetch(currentUrl, {
        headers: {
          'X-API-Key': Deno.env.get('GGDEALS_API_KEY')
        }
      });

      if (!response.ok) {
        throw new Error(`GG Deals API returned ${response.status}: ${response.statusText}`);
      }

      const { data, success } = await response.json();

      if (!data || !success) {
        throw new Error(`GG Deals API returned an error: ${JSON.stringify(data)}`);
      }

      const { next, bundles } = data;
      if (bundles && bundles.length > 0) {
        allBundles.push(...bundles);
      }

      // Set next URL for the next iteration
      currentUrl = next;
    } while (currentUrl);

    if (allBundles.length === 0) {
      return { errors: [], failed: [], successful: [] };
    }

    const records = [];
    const relationRecords = [];
    const appRecords = [];
    for (const bundle of allBundles) {
      const { title, url, dateFrom, dateTo, tiers = [] } = bundle;

      const baseRecord = {
        [Collection.fields.id]: Collection.generateID(),
        [Collection.fields.private]: false,
        [Collection.fields.type]: Collection.enums.type.bundle,
        [Collection.fields.title]: title,
        [Collection.fields.startsAt]: dateFrom ? new Date(dateFrom).toISOString() : null,
        [Collection.fields.endsAt]: dateTo ? new Date(dateTo).toISOString() : null
      };

      if (url) {
        baseRecord[Collection.fields.links] = [{ icon: 'icon-ggdeals', title: 'GG Deals', url }];
      }

      if (tiers.length === 1) {
        baseRecord[Collection.fields.title] += ` ($${tiers[0].price})`;
        baseRecord[Collection.fields.description] = `Bundle with ${tiers[0].games.length} apps: ${tiers[0].games.map(({ title }) => title).join(', ')}`;

        const appIds = tiers[0].games.map(({ steamIds }) => steamIds).flat()
          .filter((id, index, self) => id && self.indexOf(id) === index);
        for (const appId of appIds) {
          const { fields } = Collection.apps;
          appRecords.push({
            [fields.collectionId]: baseRecord[Collection.fields.id],
            [fields.appId]: appId,
            [fields.source]: Collection.enums.source.sync
          });
        }
      } else {
        baseRecord[Collection.fields.description] = `Bundle with ${tiers.length} tiers`;

        const tierRecords = [];
        for (let i = 0; i < tiers.length; i++) {
          const { price, games = [] } = tiers[i];
          const tierRecord = {
            ...baseRecord,
            [Collection.fields.id]: Collection.generateID(),
            [Collection.fields.title]: `${title} - Tier ${i + 1} ($${price})`,
            [Collection.fields.description]: `Tier with ${games.length} apps: ${games.map(({ title }) => title).join(', ')}`
          };

          const appIds = games.map(({ steamIds }) => steamIds).flat()
            .filter((id, index, self) => id && self.indexOf(id) === index);
          for (const appId of appIds) {
            const { fields } = Collection.apps;
            appRecords.push({
              [fields.collectionId]: tierRecord[Collection.fields.id],
              [fields.appId]: appId,
              [fields.source]: Collection.enums.source.sync
            });
          }

          const { fields } = Collection.relations;
          relationRecords.push({
            [fields.collectionId]: tierRecord[Collection.fields.id],
            [fields.parentId]: baseRecord[Collection.fields.id]
          });

          for (const prevTier of tierRecords) {
            relationRecords.push({
              [fields.collectionId]: prevTier[Collection.fields.id],
              [fields.parentId]: tierRecord[Collection.fields.id]
            });
          }

          tierRecords.push(tierRecord);
        }

        records.push(...tierRecords);
      }

      records.push(baseRecord);
    }

    // Save to database
    const collectionResult = await saveToDatabase(Collection.table, records, Collection.fields.id);
    const relationResult = await saveToDatabase(Collection.relations.table, relationRecords, [
      Collection.relations.fields.collectionId,
      Collection.relations.fields.parentId
    ]);
    const appResult = await saveToDatabase(Collection.apps.table, appRecords, [
      Collection.apps.fields.collectionId,
      Collection.apps.fields.appId
    ]);

    return {
      errors: [...collectionResult.errors, ...relationResult.errors, ...appResult.errors],
      failed: [],
      successful: []
    };
  } catch (error) {
    return { errors: [error], failed: [], successful: [] };
  }
};
