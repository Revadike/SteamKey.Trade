<script setup>
  import { formatDate } from '~/assets/js/format';

  const { User, App, Collection, Review, TradeMessage } = useORM();
  const supabase = useSupabaseClient();

  const searchQuery = useSearchParam('q', '');
  const domainMenu = ref(false);

  const itemsPerPage = 10;
  const domains = ref({
    apps: {
      label: 'Apps',
      sort: {
        field: App.fields.title,
        direction: 'asc'
      },
      searchFunction: async (query, pageNum = 1, sort) => {
        const queryAsInt = parseInt(query, 10) || 0;
        const { data, error, count } = await supabase
          .from(App.table)
          .select('*', { count: 'exact' })
          .or(`${App.fields.id}.eq.${queryAsInt},${App.fields.title}.wfts(english).${query}`)
          .order(sort.field, { ascending: sort.direction === 'asc' })
          .range((pageNum - 1) * itemsPerPage, pageNum * itemsPerPage - 1);

        if (error) { throw error; }
        return {
          data: data.map(app => ({
            title: app[App.fields.title],
            subtitle: app[App.fields.description],
            prependAvatar: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${app[App.fields.id]}/header.jpg`,
            to: `/app/${app[App.fields.id]}`
          })),
          count
        };
      },
      totalCount: 0,
      page: 1,
      results: []
    },
    messages: {
      label: 'Messages',
      sort: {
        field: TradeMessage.fields.createdAt,
        direction: 'desc'
      },
      searchFunction: async (query, pageNum = 1, sort) => {
        const { data, error, count } = await supabase
          .from(TradeMessage.table)
          .select(`*, ${TradeMessage.fields.tradeId}`, { count: 'exact' })
          .textSearch(TradeMessage.fields.body, query, { type: 'websearch', config: 'english' })
          .order(sort.field, { ascending: sort.direction === 'asc' })
          .range((pageNum - 1) * itemsPerPage, pageNum * itemsPerPage - 1);

        if (error) { throw error; }
        return {
          data: data.map(message => ({
            title: message[TradeMessage.fields.body],
            subtitle: formatDate(message[TradeMessage.fields.createdAt]),
            to: `/trade/${message[TradeMessage.fields.tradeId]}`
          })),
          count
        };
      },
      totalCount: 0,
      page: 1,
      results: []
    },
    reviews: {
      label: 'Reviews',
      sort: {
        field: Review.fields.createdAt,
        direction: 'desc'
      },
      searchFunction: async (query, pageNum = 1, sort) => {
        const { data, error, count } = await supabase
          .from(Review.table)
          .select(`*, ${Review.fields.subjectId}`, { count: 'exact' })
          .textSearch(Review.fields.body, query, { type: 'websearch', config: 'english' })
          .order(sort.field, { ascending: sort.direction === 'asc' })
          .range((pageNum - 1) * itemsPerPage, pageNum * itemsPerPage - 1);

        if (error) { throw error; }
        return {
          data: data.map(review => ({
            title: review[Review.fields.body],
            subtitle: formatDate(review[Review.fields.createdAt]),
            to: `/user/${review[Review.fields.subjectId]}`
          })),
          count
        };
      },
      totalCount: 0,
      page: 1,
      results: []
    },
    users: {
      label: 'Users',
      sort: {
        field: User.fields.displayName,
        direction: 'asc'
      },
      searchFunction: async (query, pageNum = 1, sort) => {
        const { data, error, count } = await supabase
          .from(User.table)
          .select('*', { count: 'exact' })
          .ilike(User.fields.displayName, `%${query}%`)
          .order(sort.field, { ascending: sort.direction === 'asc' })
          .range((pageNum - 1) * itemsPerPage, pageNum * itemsPerPage - 1);

        if (error) { throw error; }
        return {
          data: data.map(user => ({
            title: user[User.fields.displayName] || user[User.fields.id],
            subtitle: user[User.fields.steamId],
            prependAvatar: user[User.fields.avatar],
            to: `/user/${user[User.fields.customUrl] || user[User.fields.steamId]}`
          })),
          count
        };
      },
      totalCount: 0,
      page: 1,
      results: []
    },
    collections: {
      label: 'Collections',
      sort: {
        field: Collection.fields.title,
        direction: 'asc'
      },
      searchFunction: async (query, pageNum = 1, sort) => {
        const { data, error, count } = await supabase
          .from(Collection.table)
          .select('*', { count: 'exact' })
          .textSearch(Collection.fields.title, query, { type: 'websearch', config: 'english' })
          .eq(Collection.fields.private, false)
          .order(sort.field, { ascending: sort.direction === 'asc' })
          .range((pageNum - 1) * itemsPerPage, pageNum * itemsPerPage - 1);

        if (error) { throw error; }
        return {
          data: data.map(collection => ({
            title: collection[Collection.fields.title],
            subtitle: collection[Collection.fields.description],
            to: `/collection/${collection[Collection.fields.id]}`,
            prependIcon: Collection.icons[collection[Collection.fields.type]]
          })),
          count
        };
      },
      totalCount: 0,
      page: 1,
      results: []
    }
  });

  const activeDomain = ref(null);
  const allDomainKeys = Object.keys(domains.value);
  // String transformation functions for enabled domains
  const enabledDomains = useSearchParam('in', [...allDomainKeys], {
    get: (val) => val.split(','),
    set: (val) => val.join(',')
  });

  const searching = ref(true);

  const totalResults = computed(() => {
    return enabledDomains.value.reduce((acc, key) => {
      const domain = domains.value[key];
      return acc + (domain.totalCount || 0);
    }, 0);
  });

  const availableDomains = computed(() =>
    Object.entries(domains.value)
      .filter(([key]) => !enabledDomains.value.includes(key))
      .map(([key, domain]) => ({
        title: domain.label,
        value: key
      }))
  );

  const domainsWithResults = computed(() =>
    Object.entries(domains.value)
      .filter(([key, domain]) => enabledDomains.value.includes(key) && domain.results.length)
      .map(([k]) => k)
  );

  // Domain management functions
  const addDomain = (domain) => {
    enabledDomains.value = [...enabledDomains.value, domain];
    domainMenu.value = false;
  };

  const removeDomain = (domain) => {
    enabledDomains.value = enabledDomains.value.filter(d => d !== domain);
  };

  const toggleSortDirection = async (domain) => {
    const domainData = domains.value[domain];
    domainData.sort.direction = domainData.sort.direction === 'asc' ? 'desc' : 'asc';

    // Only refresh the active domain and only if needed
    if (activeDomain.value === domain) {
      // Check if all results are loaded - if so, just reverse the array
      if (domainData.results.length === domainData.totalCount && domainData.totalCount > 0) {
        domainData.results = [...domainData.results].reverse();
      } else {
        // Otherwise fetch new results for only this domain
        searching.value = true;

        try {
          domainData.page = 1;

          const { data, count } = await domainData.searchFunction(
            searchQuery.value,
            1,
            domainData.sort
          );

          // Only now replace the results with the new data
          domainData.results = data;
          domainData.totalCount = count;
        } catch (error) {
          console.error(`Error re-sorting ${domain}:`, error);
        } finally {
          searching.value = false;
        }
      }
    }
  };

  const search = () => {
    if (!searchQuery.value) { return; }
    performSearch();
  };

  const performSearch = async () => {
    searching.value = true;

    if (!searchQuery.value) {
      searching.value = false;
      return;
    }

    try {
      Object.values(domains.value).forEach(domain => {
        domain.results = [];
        domain.totalCount = 0;
      });

      // Set a default active domain if none selected
      if (!activeDomain.value && enabledDomains.value.length > 0) {
        activeDomain.value = enabledDomains.value[0];
      }

      // Search across all enabled domains in parallel
      await Promise.all(
        enabledDomains.value.map(async (domainKey) => {
          try {
            const domain = domains.value[domainKey];
            const { data, count } = await domain.searchFunction(
              searchQuery.value,
              1,
              domain.sort
            );

            domain.results = data;
            domain.totalCount = count;

            // Set the first domain with results as active if none is active
            if (data.length > 0 && !activeDomain.value) {
              activeDomain.value = domainKey;
            }
          } catch (error) {
            console.error(`Error searching in ${domainKey}:`, error);
          }
        })
      );

      // If no active domain after search, try to set one from results
      if (!activeDomain.value && domainsWithResults.value.length > 0) {
        activeDomain.value = domainsWithResults.value[0];
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      searching.value = false;
    }
  };

  const loadMoreResults = async ({ done }) => {
    const domain = domains.value[activeDomain.value];
    const hasMoreResults = domains.value[activeDomain.value].results.length < domain.totalCount;
    if (!domain || !hasMoreResults) {
      done('empty');
      return;
    }

    try {
      domain.page++;

      const { data, count } = await domain.searchFunction(
        searchQuery.value,
        domain.page,
        domain.sort
      );

      domain.results.push(...data);
      domain.totalCount = count;

      done('ok');
    } catch (error) {
      console.error(error);
      done('error');
    }
  };

  // Watchers and initialization
  watch(() => domainsWithResults.value, (val) => {
    if (val.length && !activeDomain.value) {
      activeDomain.value = val[0];
    }
  }, { immediate: true });

  // Initial search if query exists
  if (searchQuery.value) {
    performSearch();
  } else {
    searching.value = false;
  }

  // Page metadata
  const title = computed(() => searchQuery.value ? `Search results for "${searchQuery.value}"` : 'Search');

  const breadcrumbs = computed(() => ([
    { title: 'Home', to: '/' },
    { title: title.value, disabled: true }
  ]));

  useSeoMeta({ title, ogTitle: title });
</script>

<template>
  <s-page-content :breadcrumbs="breadcrumbs">
    <v-card class="h-100 pa-4">
      <h1 class="mb-4">
        <template v-if="!searchQuery">
          {{ title }}
        </template>
        <template v-else-if="searching">
          Searching...
        </template>
        <template v-else-if="domainsWithResults.length === 0">
          No results found.
        </template>
        <template v-else>
          {{ `${totalResults} result${totalResults > 1 ? 's' : ''}` }} for "{{ searchQuery }}"
        </template>
      </h1>

      <div class="d-flex flex-column">
        <div class="d-flex flex-row align-center ga-3">
          <v-text-field
            v-model="searchQuery"
            autofocus
            class="flex-grow-1"
            hide-details
            placeholder="Enter your search query..."
            prepend-inner-icon="mdi-magnify"
            :readonly="searching"
            type="search"
            @keydown.enter="search"
          />

          <v-btn
            class="flex-grow-0 rounded search-button"
            :disabled="searching || !searchQuery"
            :loading="searching"
            variant="tonal"
            @click="search"
          >
            <v-icon
              class="d-sm-none d-block"
              icon="mdi-magnify"
              size="large"
            />
            <span class="d-none d-sm-block">Search</span>
          </v-btn>
        </div>

        <div class="d-flex flex-row align-center flex-wrap ga-2 mt-2">
          <v-chip
            v-for="key in enabledDomains"
            :key="key"
            closable
            size="small"
            @click:close="removeDomain(key)"
          >
            {{ domains[key].label }}
          </v-chip>

          <v-menu
            v-model="domainMenu"
            :close-on-content-click="false"
            location="bottom"
            open-delay="0"
            open-on-hover
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                density="comfortable"
                :disabled="availableDomains.length === 0"
                icon="mdi-plus"
                size="small"
                variant="tonal"
              />
            </template>
            <v-list>
              <v-list-item
                v-for="domain in availableDomains"
                :key="domain.value"
                :title="domain.title"
                @click="addDomain(domain.value)"
              />
            </v-list>
          </v-menu>
        </div>
      </div>

      <v-tabs
        v-if="domainsWithResults.length"
        v-model="activeDomain"
        class="mt-6"
        grow
      >
        <v-tab
          v-for="key in domainsWithResults"
          :key="key"
          :value="key"
        >
          <div class="d-flex align-center ga-1">
            {{ `${domains[key].label} (${domains[key].totalCount})` }}
            <v-btn
              :disabled="activeDomain !== key"
              icon
              size="24"
              variant="text"
              @click.stop="toggleSortDirection(key)"
            >
              <v-icon
                :icon="domains[key].sort.direction === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'"
                :opacity="activeDomain === key ? 1 : 0.5"
                size="small"
              />
            </v-btn>
          </div>
        </v-tab>
      </v-tabs>

      <v-divider v-if="domainsWithResults.length" />

      <v-infinite-scroll
        :empty-text="''"
        margin="100"
        mode="intersect"
        @load="loadMoreResults"
      >
        <v-list>
          <v-list-item
            v-for="item in domains[activeDomain].results"
            :key="item.to"
            v-bind="item"
            :disabled="searching"
            link
          />
        </v-list>

        <template #loading>
          <v-skeleton-loader
            v-if="domains[activeDomain].results.length < domains[activeDomain].totalCount"
            class="w-100 ml-n8"
            type="list-item-avatar-two-line@4"
          />
        </template>
      </v-infinite-scroll>
    </v-card>
  </s-page-content>
</template>

<style lang="scss" scoped>
  .search-button {
    height: 56px;
  }
</style>
