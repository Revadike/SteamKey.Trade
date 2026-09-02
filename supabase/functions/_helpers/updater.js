import { strToU8, gzipSync } from 'fflate';
import { supabaseAdmin } from './supabase.js';
import { App } from '../_entities/App.js';

/**
 * Compresses apps metadata JSON with gzip and uploads it to Supabase storage
 *
 * @returns {Promise<Object>} Result of the operation
 */
export const dumpAppsMetadata = async () => {
  // Check if file age is older than 24 hours
  const { data: fileInfo, error: fileError } = await supabaseAdmin
    .storage
    .from('assets')
    .getPublicUrl('apps.metadata.json.gz');

  if (!fileError && fileInfo) {
    const response = await fetch(fileInfo.publicUrl, { method: 'HEAD' });
    if (response.ok) {
      const lastModified = new Date(response.headers.get('last-modified'));
      const now = new Date();
      const ageInHours = (now - lastModified) / (1000 * 60 * 60);

      // If file is less than 24 hours old, skip update
      if (ageInHours < 24) {
        return {
          success: true,
          message: 'App metadata is up to date (less than 24 hours old)',
          age: `${Math.round(ageInHours * 10) / 10} hours`
        };
      }
    }
  }

  // Call rpc to get_apps_metadata
  const { data, error: rpcError } = await supabaseAdmin.rpc('get_apps_metadata');

  if (rpcError) {
    throw new Error(`Failed to get apps metadata: ${rpcError.message}`);
  }

  if (!data || !Array.isArray(data)) {
    throw new Error('Invalid data returned from get_apps_metadata');
  }

  // Process data
  const processedData = data.map(app => App.fromDB(app));

  // Convert data to JSON string
  const jsonString = JSON.stringify(processedData);

  // Compress data with gzip (best compression)
  const compressedData = gzipSync(strToU8(jsonString), { level: 9 });

  // Upload to Supabase Storage
  const { data: uploadData, error } = await supabaseAdmin
    .storage
    .from('assets')
    .upload('apps.metadata.json.gz', compressedData, {
      contentType: 'application/gzip',
      cacheControl: '86400', // 24 hours in seconds
      upsert: true // Overwrite if exists
    });

  if (error) {
    throw error;
  }

  return {
    success: true,
    message: 'App metadata successfully compressed and uploaded',
    path: uploadData.path
  };
};

/**
 * Extracts the queued apps from the updater queue by invoking the updater_dequeue RPC.
 * @param {number} count - The maximum number of apps to retrieve.
 * @returns {Promise<Array<number>>} An array of app IDs.
 */
export const dequeueApps = async (count = 200) => {
  const { data, error } = await supabaseAdmin.rpc('updater_dequeue', { p_count: count });

  if (error) {
    return [];
  }

  return data;
};

/**
 * Pushes apps to the updater queue by invoking the public.updater_enqueue RPC.
 * @param {Array<number>} appIds - An array of app IDs to queue.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 * @throws Will throw an error if the RPC call fails.
 */
export const enqueueApps = async (appIds) => {
  if (!appIds || appIds.length === 0) {
    return true;
  }

  const { error } = await supabaseAdmin.rpc('updater_enqueue', { p_appids: appIds });
  if (error) {
    throw error;
  }

  return !error;
};

/**
 * Gets the latest check timestamp from the updater queue for a specific type
 * @param {string} type - The type of check to retrieve
 * @returns {Promise<string|null>} The value of the latest check or null if not found
 */
export const getLastCheck = async (type) => {
  const { data, error } = await supabaseAdmin
    .from('updater_queue')
    .select('value')
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0].value;
};

/**
 * Updates the check timestamp in the updater queue
 * @param {string} type - The type of check to update
 * @param {string|number} value - The value to store
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export const updateLastCheck = async (type, value) => {
  // Delete existing records of this type
  await supabaseAdmin
    .from('updater_queue')
    .delete()
    .eq('type', type);

  // Insert new record
  const { error } = await supabaseAdmin
    .from('updater_queue')
    .insert({
      type,
      value: value.toString()
    });

  return !error;
};

/**
 * Adds an app to the update queue
 * @param {number} appId - The app ID to queue for update
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export const queueAppForUpdate = async (appId) => {
  const { error } = await supabaseAdmin
    .from('updater_queue')
    .insert({
      type: 'app_update',
      value: appId.toString()
    });

  return !error;
};

/**
 * Saves records to the database using bulk update
 * @param {string} table - The table name to update
 * @param {Array<Object>} records - The records to save to the database
 * @param {string|Array} [conflictField='id'] - The field to use for conflict resolution. May be a single field or an array of fields.
 * @param {number} [batchSize=1000] - Maximum number of records to update in a single operation
 * @param {number} [maxRetries=3] - Maximum number of retries for failed operations
 * @returns {Promise<Object>} Object containing success and failure information
 */
export const saveToDatabase = async (table, records, conflictField = 'id', batchSize = 1000, maxRetries = 3) => {
  const conflictFields = Array.isArray(conflictField) ? conflictField : [conflictField];

  // Ensure we have valid data to process
  if (!records || records.length === 0) {
    return { errors: [], successful: [], failed: [] };
  }

  const errors = [];
  const failed = [];
  const successful = [];

  // Helper function for retrying operations with delay
  const retryOperation = async (operation, retries) => {
    try {
      return await operation();
    } catch (err) {
      if (retries <= 0) {
        throw err;
      }

      // Exponential backoff with jitter
      const delay = Math.floor(Math.random() * 1000) + 1000 * Math.pow(2, maxRetries - retries);
      await new Promise(resolve => setTimeout(resolve, delay));

      console.log(`Retrying operation, ${retries} attempts left`);
      return retryOperation(operation, retries - 1);
    }
  };

  // Group records by their updated fields signature
  const recordsByFields = {};

  for (const record of records) {
    // Create a signature based on the fields present in the record
    const fieldSignature = Object.keys(record).sort()
      .join(',');

    if (!recordsByFields[fieldSignature]) {
      recordsByFields[fieldSignature] = {
        records: [],
        updatedFields: Object.keys(record)
      };
    }

    // Check if this record is already included based on conflict fields
    const existingRecords = recordsByFields[fieldSignature].records;
    if (!existingRecords.some(r => conflictFields.every(field => r[field] === record[field]))) {
      existingRecords.push(record);
    }
  }

  // Process each group separately
  for (const fieldSignature in recordsByFields) {
    const group = recordsByFields[fieldSignature];
    const uniqueRecords = group.records;
    const updatedFields = group.updatedFields;

    // Process in batches
    for (let i = 0; i < uniqueRecords.length; i += batchSize) {
      const batch = uniqueRecords.slice(i, i + batchSize);
      if (batch.length === 0) {
        continue;
      }

      try {
        const operation = async () => {
          const { error } = await supabaseAdmin.rpc('bulk_upsert', {
            p_table: table,
            p_records: batch,
            p_update_fields: updatedFields,
            p_conflict_fields: conflictFields
          });

          if (error) {
            throw error;
          }

          return { error: null };
        };

        // Try the operation with retries
        const result = await retryOperation(operation, maxRetries);

        if (result.error) {
          errors.push(result.error);
          failed.push(...batch);
        } else {
          successful.push(...batch);
        }
      } catch (error) {
        console.error(`Batch operation failed after ${maxRetries} retries:`, error);
        errors.push(error);
        failed.push(...batch);
      }
    }
  }

  return { errors, successful, failed };
};
