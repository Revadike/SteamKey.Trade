const MAX_SEARCH_BATCH_SIZE = 20;
const DEFAULT_SEARCH_LIMIT = 20;

/**
 * Composable for searching apps through Supabase-backed ORM helpers.
 *
 * Provides two async methods:
 * - `search(query, limit)`: searches a single query string and returns a flat array of mapped results.
 * - `searchMany(queries, limit)`: searches one or more queries, preserving the original input order and returning
 *   an array of `{ query, results }` objects.
 *
 * Empty or whitespace-only queries return an empty result set.
 *
 * @returns {{
 *   search: (query: string, limit?: number) => Promise<Array<any>>,
 *   searchMany: (queries: string | string[], limit?: number) => Promise<Array<{ query: string, results: Array<any> }>>
 * }} An object containing app search helpers.
 */
export const useSearchApps = () => {
  const supabase = useSupabaseClient();
  const { App } = useORM();

  const searchMany = async (queries, limit = DEFAULT_SEARCH_LIMIT) => {
    const queryEntries = (Array.isArray(queries) ? queries : [queries]).map((query, index) => ({
      index,
      raw: `${query ?? ''}`,
      normalized: `${query ?? ''}`.trim()
    }));

    const uniqueQueries = [...new Set(queryEntries.map(entry => entry.normalized).filter(Boolean))];
    const resultsByQuery = Object.fromEntries(uniqueQueries.map(query => [query, []]));

    for (let i = 0; i < uniqueQueries.length; i += MAX_SEARCH_BATCH_SIZE) {
      const batch = uniqueQueries.slice(i, i + MAX_SEARCH_BATCH_SIZE);
      const rows = await App.search(supabase, batch, limit);

      rows.forEach(row => {
        const key = `${row.query ?? ''}`.trim();
        if (!resultsByQuery[key]) {
          resultsByQuery[key] = [];
        }

        const confidence = Math.min(1, Math.max(0, Number(row.confidence || 0)));

        resultsByQuery[key].push({
          item: {
            appid: row.id,
            names: [row.title].concat(row.altTitles || []),
            header: row.header,
            type: row.type
          },
          score: 1 - confidence
        });
      });
    }

    return queryEntries
      .sort((a, b) => a.index - b.index)
      .map(({ raw, normalized }) => ({
        query: raw,
        results: normalized ? (resultsByQuery[normalized] || []) : []
      }));
  };

  const search = async (query, limit = DEFAULT_SEARCH_LIMIT) => {
    const [{ results = [] } = {}] = await searchMany([query], limit);
    return results;
  };

  return {
    search,
    searchMany
  };
};
