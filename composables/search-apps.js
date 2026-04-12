const MAX_SEARCH_BATCH_SIZE = 20;
const DEFAULT_SEARCH_LIMIT = 20;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const mapSearchResult = result => {
  const confidence = clamp(Number(result.confidence || 0), 0, 1);

  return {
    item: {
      appid: result.id,
      names: [result.title].concat(result.altTitles || []),
      header: result.header,
      type: result.type
    },
    score: 1 - confidence
  };
};

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
        resultsByQuery[key].push(mapSearchResult(row));
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
