import { App, Collection } from '../_entities/index.js';
import { saveToDatabase } from '../_helpers/updater.js';

/**
 * Processes a list of Steam app IDs by fetching game details from the Steam Store API
 * and saving the processed data to a database.
 *
 * @param {number[]} appids - An array of Steam app IDs to process.
 * @returns {Promise<Object>} A promise that resolves to an object containing the results:
 * - `errors`: An array of errors encountered during processing.
 * - `failed`: An array of records that failed to process.
 * - `successful`: An array of successfully processed records.
 */
export const processSteamStoreDetails = async (appids) => {
  const errors = [];
  const appRecords = [];
  const collectionRecords = [];
  const collectionAppRecords = [];

  await Promise.all(appids.map(async (appid) => {
    try {
      const record = {
        [App.fields.id]: appid
      };

      const url = new URL('https://store.steampowered.com/api/appdetails');
      url.searchParams.append('appids', appid);
      url.searchParams.append('cc', 'us');
      url.searchParams.append('l', 'english');

      const response = await fetch(url);
      const data = await response.json();

      if (!data?.[appid]?.success === false && !data?.[appid]?.data) {
        throw new Error(`Steam Store API returned an error for app ${appid}: ${JSON.stringify(data)}`);
      }

      const storeInfo = data[appid].data;

      if (storeInfo.type) {
        record[App.fields.type] = storeInfo.type.toLowerCase();
      }

      if (storeInfo.name) {
        record[App.fields.title] = storeInfo.name;
      }

      if (storeInfo.short_description) {
        record[App.fields.description] = storeInfo.short_description;
      }

      if (storeInfo.developers) {
        record[App.fields.developers] = storeInfo.developers;
      }

      if (storeInfo.publishers) {
        record[App.fields.publishers] = storeInfo.publishers;
      }

      if (storeInfo.website) {
        record[App.fields.website] = storeInfo.website;
      }

      if (storeInfo.is_free) {
        record[App.fields.free] = true;
      }

      if (storeInfo.categories) {
        record[App.fields.tags] = storeInfo.categories.map(category => category.description.trim().toLowerCase());
      }

      if (storeInfo.genres) {
        record[App.fields.tags] = storeInfo.genres.map(genre => genre.description.trim().toLowerCase());
      }

      if (storeInfo.supported_languages) {
        const text = storeInfo.supported_languages.split('<br>')[0].replace(/<strong>\*<\/strong>/g, '');
        record[App.fields.languages] = text.split(',').map(lang => lang.trim().toLowerCase());
      }

      if (storeInfo.platforms) {
        record[App.fields.platforms] = Object.entries(storeInfo.platforms).filter(([, value]) => value)
          .map(([key]) => key.trim().toLowerCase());
      }

      if (storeInfo.demos) {
        storeInfo.demos.forEach((demo) => {
          const existingIndex = appRecords.findIndex(r => r[App.fields.id] === demo.appid);
          if (existingIndex !== -1) {
            appRecords[existingIndex][App.fields.parentId] = appid;
            appRecords[existingIndex][App.fields.type] = App.enums.type.demo;
            return;
          }

          appRecords.push({
            [App.fields.id]: demo.appid,
            [App.fields.type]: App.enums.type.demo,
            [App.fields.parentId]: appid
          });
        });
      }

      if (storeInfo.header_image) {
        record[App.fields.header] = storeInfo.header_image;
      }

      if (storeInfo.screenshots) {
        record[App.fields.screenshots] = storeInfo.screenshots.map(({ path_full }) => path_full);
      }

      if (storeInfo.movies) {
        record[App.fields.videos] = storeInfo.movies.map(({ webm }) => webm.max);
      }

      if (storeInfo.price_overview) {
        record[App.fields.discountedPrice] = storeInfo.price_overview.final / 100; // in USD
        record[App.fields.retailPrice] = storeInfo.price_overview.initial / 100; // in USD
      }

      if (storeInfo.achievements?.total !== undefined) {
        record[App.fields.achievements] = storeInfo.achievements.total;
      }

      if (storeInfo.release_date) {
        const releaseDate = new Date(storeInfo.release_date.date);
        if (!isNaN(releaseDate.getTime())) {
          record[App.fields.releasedAt] = releaseDate;
        }
      }

      appRecords.push(record);

      for (const group of storeInfo.package_groups || []) {
        for (const sub of group.subs || []) {
          if (sub.packageid) {
            const title = sub.option_text
              ? sub.option_text.replace(/<span class="discount_original_price">.*<\/span>/g, '').trim()
              : `Unknown Package ${sub.packageid}`;
            collectionRecords.push({
              [Collection.fields.id]: `package-${sub.packageid}`,
              [Collection.fields.title]: title,
              [Collection.fields.type]: Collection.enums.type.steamPackage,
              [Collection.fields.links]: [{
                title: 'Steam Store',
                icon: 'mdi-steam',
                url: `https://store.steampowered.com/sub/${sub.packageid}/`
              }, {
                title: 'SteamDB',
                icon: 'icon-steamdb',
                url: `https://steamdb.info/sub/${sub.packageid}/`
              }]
            });

            collectionAppRecords.push({
              [Collection.apps.fields.collectionId]: `package-${sub.packageid}`,
              [Collection.apps.fields.appId]: appid,
              [Collection.apps.fields.source]: Collection.enums.source.sync
            });
          }
        }
      }
    } catch (error) {
      errors.push(error);
    }
  }));

  // Save app records to database
  const appResult = await saveToDatabase(App.table, appRecords, App.fields.id);
  const collectionResult = await saveToDatabase(Collection.table, collectionRecords, Collection.fields.id);
  const collectionAppResult = await saveToDatabase(Collection.apps.table, collectionAppRecords, [
    Collection.apps.fields.collectionId,
    Collection.apps.fields.appId
  ]);

  const failed = [];
  const successful = [];
  for (const appid of appids) {
    const appRecord = appRecords.find(record => record[App.fields.id] === appid);
    if (appRecord && appResult.successful.some(record => record[App.fields.id] === appid)) {
      successful.push(appRecord);
    } else {
      failed.push(appRecord || { [App.fields.id]: appid });
    }
  }

  return {
    errors: [...appResult.errors, ...collectionResult.errors, ...collectionAppResult.errors],
    failed,
    successful,
    appResult,
    collectionResult,
    collectionAppResult
  };
};

