<script setup>
  import TableData from './TableData.vue';
  import { VDataTable } from 'vuetify/components';
  import { formatNumber, slugify } from '~/assets/js/format';

  const { App, Collection, VaultEntry, Trade } = useORM();
  const supabase = useSupabaseClient();
  const { preferences, isLoggedIn, user } = storeToRefs(useAuthStore());
  const { inLibrary, inWishlist, inBlacklist, inTradelist } = useCollectionsStore();

  const table = ref(null);
  const props = defineProps({
    items: {
      type: Array,
      default: null
    },
    onlyApps: {
      type: Array,
      default: null
    },
    onlyCollections: {
      type: Array,
      default: null
    },
    excludeCollections: {
      type: Array,
      default: null
    },
    onlyVaultUnsent: {
      type: Boolean,
      default: false
    },
    onlyVaultSent: {
      type: Boolean,
      default: false
    },
    onlyVaultReceived: {
      type: Boolean,
      default: false
    },
    includeApps: {
      type: Array,
      default: null
    },
    excludeApps: {
      type: Array,
      default: null
    },
    onlyParents: {
      type: Array,
      default: null
    },
    noMandatory: {
      type: Boolean,
      default: false
    },
    simple: {
      type: Boolean,
      default: false
    },
    // Requires v-model to be set on this component to work properly!
    showSelect: {
      type: Boolean,
      default: false
    },
    maxSelection: {
      type: Number,
      default: null
    }
  });

  const refresh = () => {
    return table.value?.refresh?.();
  };

  watch([
    () => props.excludeApps,
    () => props.includeApps,
    () => props.onlyCollections,
    () => props.onlyParents,
    () => props.onlyVaultUnsent,
    () => props.onlyVaultSent,
    () => props.onlyVaultReceived
  ], () => refresh(), { deep: true });

  const selected = defineModel({
    type: Array,
    default: () => []
  });

  const mandatory = defineModel('mandatory', {
    type: Array,
    default: () => []
  });

  // Helper functions for app links
  const getLinkVars = link => (link.match(/\{(.+?)\}/g) ?? []).map(varName => varName.slice(1, -1));

  const getAppLink = (app, link) => {
    const vars = getLinkVars(link);
    if (!vars.length) {
      return link;
    }
    return vars.reduce((acc, varName) => {
      const value = app[varName === 'appid' ? 'id' : varName];
      return acc.replace(`{${varName}}`, value);
    }, link);
  };

  const visibleAppLinks = app => {
    const links = preferences.value?.appLinks || [
      { title: 'Homepage', url: '{website}' },
      { title: 'Steam Store', url: 'https://store.steampowered.com/app/{appid}' },
      { title: 'Steam Community', url: 'https://steamcommunity.com/app/{appid}' },
      { title: 'SteamDB', url: 'https://steamdb.info/app/{appid}/' },
      { title: 'GG.deals', url: 'https://gg.deals/steam/app/{appid}/' }
    ];
    return links.filter(({ url }) => getLinkVars(url).every(varName => {
      const value = app[varName === 'appid' ? 'id' : varName];
      return value !== undefined && value !== null;
    }));
  };

  const getCollectionLink = (prop, value) => {
    switch (prop) {
      case App.fields.type:
        return `/collection/type-${value}`;
      case App.fields.developers:
        return `/collection/developer-${slugify(value)}`;
      case App.fields.publishers:
        return `/collection/publisher-${slugify(value)}`;
      case App.fields.tags:
        return `/collection/tag-${slugify(value)}`;
      case App.fields.languages:
        return `/collection/language-${slugify(value)}`;
      case App.fields.platforms:
        return `/collection/platform-${slugify(value)}`;
      default:
        return undefined;
    }
  };

  const { names: tagNames } = storeToRefs(useTagsStore());
  const getTags = item => {
    if (!item?.collection?.[0]?.tags?.length && !item.snapshot?.tags?.length) {
      return [];
    }

    const { fields } = Collection.tags;
    const tags = item.snapshot?.tags?.length
      ? item.snapshot.tags
      : item.collection[0].tags.filter(tag => {
        return tag[fields.appId] === item.id;
      });

    return tags.map(tag => Collection.fromDB(tag, fields));
  };

  const deleteTag = async tag => {
    const { fields, table } = Collection.tags;
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(fields.collectionId, tag.collectionId)
      .eq(fields.appId, tag.appId)
      .eq(fields.tagId, tag.tagId);

    if (!error) {
      tag = null;
    }
  };

  const isSelected = id => !!selected.value.find(v => v.id.toString() === id.toString());
  const isMandatory = id => !!mandatory.value.find(v => v.id.toString() === id.toString());

  // workaround for mandatory items not always being removed from selected (e.g. through using selectAll)
  watch(() => selected.value, () => {
    mandatory.value = mandatory.value.filter(item => isSelected(item.id));
  });

  const select = item => {
    if (!props.showSelect) {
      return;
    }

    const { id } = item;

    // toggle between selected and unselected (mandatory stays locked)
    if (props.noMandatory) {
      // if the item is selected and not mandatory, remove it from selected
      if (isSelected(id) && !isMandatory(id)) {
        const index = selected.value.findIndex(v => v.id.toString() === id.toString());
        selected.value.splice(index, 1);
        // if the item is not selected, add it to selected (only if not max selection)
      } else if (!isSelected(id)) {
        if (props.maxSelection && selected.value.length >= props.maxSelection) {
          return;
        }
        selected.value.push(item);
      }
      // cycle through selected, mandatory and unselected
    } else {
      // if the item is selected and not mandatory, remove it from selected
      if (!isSelected(id)) {
        if (isMandatory(id)) {
          const index = mandatory.value.findIndex(v => v.id.toString() === id.toString());
          mandatory.value.splice(index, 1);
        }
        if (props.maxSelection !== null && selected.value.length >= props.maxSelection) {
          return;
        }
        selected.value.push(item);
      } else if (isMandatory(id)) {
        const selectedIndex = selected.value.findIndex(v => v.id.toString() === id.toString());
        selected.value.splice(selectedIndex, 1);
        const mandatoryIndex = mandatory.value.findIndex(v => v.id.toString() === id.toString());
        mandatory.value.splice(mandatoryIndex, 1);
      } else {
        mandatory.value.push(item);
      }
    }

    // workaround for selection visuals not re-rendering
    selected.value = [...selected.value];
  };

  const getRowClass = item => {
    return {
      'v-data-table__tr position-relative app-row': true,
      'in-library': inLibrary(item.id),
      'in-wishlist': inWishlist(item.id),
      'in-blacklist': inBlacklist(item.id),
      'in-tradelist': inTradelist(item.id)
    };
  };

  const queryGetter = (selectedOnly) => {
    if (props.onlyApps) {
      let query = supabase
        .from(App.table)
        .select();

      if (selectedOnly) {
        query = query.in(App.fields.id, selected.value.map(({ id }) => id));
      } else {
        query = query.in(App.fields.id, props.onlyApps);
      }

      if (props.excludeApps?.length) {
        query = query.not(App.fields.id, 'in', `(${props.excludeApps.join(',')})`);
      }

      return query;
    }

    if (props.onlyCollections || props.excludeCollections) {
      let query = supabase
        .from(App.table)
        .select(`*,
          collection:${Collection.apps.table}${props.includeApps?.length ? '' : '!inner'}(
            ${Collection.apps.fields.collectionId},
            ...${Collection.table}(
              ${Collection.fields.userId},
              tags:${Collection.tags.table}!inner(
                ${Collection.tags.fields.collectionId},
                ${Collection.tags.fields.appId},
                ${Collection.tags.fields.tagId},
                ${Collection.tags.fields.body}
              )
            )
          )
        `);

      if (props.onlyCollections?.length) {
        // This filter applies to the embedded alias – only matching rows where collection_id is the desired value.
        query = query.in(`collection.${Collection.apps.fields.collectionId}`, props.onlyCollections);
      }

      if (props.excludeCollections?.length) {
        // Exclude apps that are in the specified collections
        query = query.not(`collection.${Collection.apps.fields.collectionId}`, 'in', `(${props.excludeCollections.join(',')})`);
      }

      if (props.includeApps?.length) {
        // The OR clause says: either the embedded alias exists (i.e. there is a match for collection_id)
        // or the app id is in the given list.
        query = query.or(`collection.not.is.null, ${App.fields.id}.in.(${(props.includeApps || []).join(',')})`);
      } else if (props.excludeApps?.length || selectedOnly) {
        // If no includeApps are specified, we want to exclude apps that are not in the collection.
        query = query.or(`collection.not.is.null, ${App.fields.id}.is.null`);
      }

      if (props.excludeApps?.length) {
        query = query.not(App.fields.id, 'in', `(${props.excludeApps.join(',')})`);
      }

      if (selectedOnly) {
        query = query.in(App.fields.id, selected.value.map(({ id }) => id));
      }

      return query;
    }

    if (props.onlyVaultUnsent || props.onlyVaultSent || props.onlyVaultReceived) {
      if (!isLoggedIn.value) {
        throw new Error('User is not logged in and cannot access vault entries.');
      }

      if (props.onlyVaultUnsent) {
        return supabase
          .from(App.table)
          .select(`*,
            ${VaultEntry.table}!inner(
              ${VaultEntry.fields.userId},
              ${VaultEntry.fields.tradeId}
            )
          `)
          // Only our vault apps (we don't have access to other's vault items anyway)
          .eq(`${VaultEntry.table}.${VaultEntry.fields.userId}`, user.value.id)
          // Only unsent vault items
          .is(`${VaultEntry.table}.${VaultEntry.fields.tradeId}`, null);
      }

      const query = supabase
        .from(App.table)
        .select(`*,
          ${VaultEntry.table}!inner(
            ${VaultEntry.fields.userId},
            ${VaultEntry.fields.tradeId}
          ),
          ${Trade.apps.table}!inner(
            ${Trade.apps.fields.appId},
            ${Trade.apps.fields.tradeId},
            ${Trade.apps.fields.selected},
            ${Trade.apps.fields.userId}
          )
        `)
        // Only our vault apps (we don't have access to other's vault items anyway)
        .eq(`${VaultEntry.table}.${VaultEntry.fields.userId}`, user.value.id)
        // Only sent vault items
        .not(`${VaultEntry.table}.${VaultEntry.fields.tradeId}`, 'is', null)
        // Only those that were selected in a trade
        .eq(`${Trade.apps.table}.${Trade.apps.fields.selected}`, true);

      if (props.onlyVaultSent) {
        // Only items that came from me
        return query.eq(`${Trade.apps.table}.${Trade.apps.fields.userId}`, user.value.id);
      } else if (props.onlyVaultReceived) {
        // Only items that came from the other user
        return query.neq(`${Trade.apps.table}.${Trade.apps.fields.userId}`, user.value.id);
      }
    }

    const query = supabase
      .from(App.table)
      .select();

    if (props.onlyParents?.length) {
      query.in(App.fields.parentId, props.onlyParents);
    }

    if (props.excludeApps?.length) {
      query.not(App.fields.id, 'in', `(${props.excludeApps.join(',')})`);
    }

    if (selectedOnly) {
      query.in(App.fields.id, selected.value.map(({ id }) => id));
    }

    // includeApps not applicable here yet

    return query;
  };

  // Determine visible app properties from user preferences
  const visibleAppFields = computed(() => {
    const dbKeys = props.simple
      ? [
        App.fields.title,
        App.fields.type,
        App.fields.marketPrice
      ]
      : preferences.value?.appColumns || [
        App.fields.title,
        App.fields.type,
        App.fields.retailPrice,
        App.fields.marketPrice,
        App.fields.plusOne,
        App.fields.cards,
        App.fields.achievements,
        App.fields.tradelists,
        App.fields.wishlists
      ];
    const inverted = Object.fromEntries(Object.entries(App.fields).map(([key, value]) => [value, key]));
    return dbKeys.map(key => inverted[key]);
  });

  // Create headers based on visible app properties
  const headers = computed(() => ([
    ...visibleAppFields.value.map(field => ({
      title: App.labels[field] || field,
      key: App.fields[field]
    })),
    { title: 'Links', align: 'end', key: 'links', sortable: false }
  ]));

  const appTypes = Object.entries(App.enums.type).map(([key, value]) => ({ title: App.labels[key], value }));
  const { facets } = storeToRefs(useAppsStore());
  const filters = computed(() => ([
    { title: App.labels.id, value: App.fields.id, type: Number },
    { title: App.labels.changeNumber, value: App.fields.changeNumber, type: Number },
    { title: App.labels.parentId, value: App.fields.parentId, type: Number },
    { title: App.labels.type, value: App.fields.type, type: String, options: appTypes },
    { title: App.labels.description, value: App.fields.description, type: String },
    { title: App.labels.developers, value: App.fields.developers, type: Array, options: facets.value?.developers },
    { title: App.labels.publishers, value: App.fields.publishers, type: Array, options: facets.value?.publishers },
    { title: App.labels.tags, value: App.fields.tags, type: Array, options: facets.value?.tags },
    { title: App.labels.languages, value: App.fields.languages, type: Array, options: facets.value?.languages },
    { title: App.labels.platforms, value: App.fields.platforms, type: Array, options: facets.value?.platforms },
    { title: App.labels.free, value: App.fields.free, type: Boolean },
    { title: App.labels.plusOne, value: App.fields.plusOne, type: Boolean },
    { title: App.labels.exfgls, value: App.fields.exfgls, type: Boolean },
    { title: App.labels.steamdeck, value: App.fields.steamdeck, type: Boolean },
    { title: App.labels.positiveReviews, value: App.fields.positiveReviews, type: Number },
    { title: App.labels.negativeReviews, value: App.fields.negativeReviews, type: Number },
    { title: App.labels.cards, value: App.fields.cards, type: Number },
    { title: App.labels.achievements, value: App.fields.achievements, type: Number },
    { title: App.labels.bundles, value: App.fields.bundles, type: Number },
    { title: App.labels.giveaways, value: App.fields.giveaways, type: Number },
    { title: App.labels.libraries, value: App.fields.libraries, type: Number },
    { title: App.labels.wishlists, value: App.fields.wishlists, type: Number },
    { title: App.labels.tradelists, value: App.fields.tradelists, type: Number },
    { title: App.labels.blacklists, value: App.fields.blacklists, type: Number },
    { title: App.labels.steamPackages, value: App.fields.steamPackages, type: Number },
    { title: App.labels.steamBundles, value: App.fields.steamBundles, type: Number },
    { title: App.labels.retailPrice, value: App.fields.retailPrice, type: Number },
    { title: App.labels.discountedPrice, value: App.fields.discountedPrice, type: Number },
    { title: App.labels.marketPrice, value: App.fields.marketPrice, type: Number },
    { title: App.labels.historicalLow, value: App.fields.historicalLow, type: Number },
    { title: App.labels.removedAs, value: App.fields.removedAs, type: String, options: facets.value?.removedAs },
    { title: App.labels.removedAt, value: App.fields.removedAt, type: String },
    { title: App.labels.releasedAt, value: App.fields.releasedAt, type: Date },
    { title: App.labels.updatedAt, value: App.fields.updatedAt, type: Date },
    { title: App.labels.createdAt, value: App.fields.createdAt, type: Date }
  ]));

  const hasTotals = computed(() => Array.isArray(props.items) && props.items.some(i => i.total != null && i.total !== undefined && i.total > 1));

  // Determine which table component to use based on the presence of items
  const component = computed(() =>
    Array.isArray(props.items) ? VDataTable : TableData
  );

  const tableProps = computed(() => {
    const baseProps = {
      headers: headers.value,
      maxSelection: props.showSelect ? props.maxSelection : 0,
      multiple: true,
      mustSort: true,
      noDataText: 'No apps found',
      returnObject: true,
      showSelect: true,
      simple: props.simple,
      hideDefaultHeader: props.simple,
      hideDefaultBody: true
    };

    if (Array.isArray(props.items)) {
      // Regular table
      return {
        ...baseProps,
        items: [...props.items].map(item => ({
          ...App.toDB(item),
          snapshot: {
            ...item.snapshot,
            app: App.toDB(item.snapshot?.app)
          },
          total: item.total
        })),
        itemsPerPage: 10,
        hideDefaultFooter: props.items.length <= 10,
        headerProps: { class: 'text-overline', style: { lineHeight: 1.5 } }
      };
    } else {
      // Our own data table
      return {
        ...baseProps,
        queryGetter,
        // mapItem: (item) => item.apps || item,
        // mapKey: (key) => `apps(${key})`,
        searchField: App.fields.title,
        filters: filters.value
      };
    }
  });

  const emit = defineEmits(['click:row']);
  const clickRow = (item) => {
    emit('click:row', item);
    select(item);
  };

  const tableEvents = computed(() => {
    return Array.isArray(props.items)
      ? { 'click:row': (_, { item }) => clickRow(toRaw(item)) }
      : { 'click:row': clickRow };
  });

  defineExpose({
    refresh
  });
</script>

<template>
  <component
    :is="component"
    ref="table"
    v-bind="tableProps"
    v-model="selected"
    class="app-table"
    :row-props="({ item }) => ({ class: getRowClass(item) })"
    v-on="tableEvents"
  >
    <template #[`header.data-table-select`]="{ selectAll, someSelected, allSelected }">
      <div
        class="d-flex flex-row align-center"
        style="min-width: 60px;"
      >
        <div
          v-if="hasTotals"
          class="text-overline v-data-table-header__content d-flex justify-center align-center"
          style="width: 40px;"
        >
          <span>
            #
          </span>
        </div>
        <v-checkbox
          v-if="showSelect"
          :color="allSelected ? 'primary' : ''"
          hide-details
          :indeterminate="someSelected && !allSelected"
          :model-value="allSelected"
          @click="selectAll(!allSelected)"
        />

        <v-tooltip
          v-if="props.showSelect"
          location="right"
          open-on-click
        >
          <template #activator="attrs">
            <v-icon
              v-bind="attrs.props"
              color="grey"
              icon="mdi-information-outline"
            />
          </template>

          <p>
            <v-icon icon="mdi-lock" /> is a mandatory pick for the user
          </p>

          <p>
            <v-icon icon="mdi-check" /> is a choice for the user
          </p>
        </v-tooltip>
      </div>
    </template>

    <template #[`header.links`]>
      <dialog-app-table-settings v-if="isLoggedIn">
        <template #activator="attrs">
          <v-icon
            v-bind="attrs.props"
            icon="mdi-cog"
          />
        </template>
      </dialog-app-table-settings>
    </template>

    <template #tbody="{ items: rowItems }">
      <tbody
        v-if="table?.loading && !rowItems.length"
        class="v-data-table__tbody"
      >
        <v-progress-linear
          v-if="simple"
          indeterminate
        />
        <!-- <tr
          v-for="i in 10"
          :key="i"
          class="v-data-table__tr position-relative app-row"
        >
          <td
            v-if="showSelect || tableProps.showSelect"
            class="v-data-table__td v-data-table-column--align-start"
          >
            <div class="app-avatar">
              <v-skeleton-loader
                class="h-100 w-100"
                type="image"
              />
            </div>
          </td>
          <td
            v-for="header in headers"
            :key="header.key"
            class="v-data-table__td v-data-table-column--align-start"
          >
            <v-skeleton-loader
              class="w-100 h-100"
              type="text"
            />
          </td>
        </tr> -->
      </tbody>
      <div
        v-else-if="rowItems.length === 0"
        class="d-flex position-absolute w-100 h-100 align-center justify-center overflow-hidden top-0 po"
        :style="{
          pointerEvents: 'none',
          paddingTop: props.simple ? '0' : '116px',
          paddingBottom: '56px',
        }"
      >
        <span class="text-disabled font-italic">No apps found</span>
      </div>
      <tbody
        v-else
        class="v-data-table__tbody"
      >
        <template
          v-for="item in rowItems"
          :key="item.id"
        >
          <tr
            v-ripple
            :class="getRowClass(item)"
            @click="clickRow(item)"
          >
            <!-- Data table select column -->
            <td
              v-if="(showSelect || tableProps.showSelect)"
              class="v-data-table__td v-data-table-column--align-start d-flex flex-row align-center h-100 justify-space-between"
              :style="getTags(item).length ? { borderBottom: 'none' } : {}"
            >
              <div
                v-if="item.total != null && item.total !== undefined && hasTotals"
                class="d-flex flex-row align-center justify-center flex-grow-1 px-2"
              >
                <h2>
                  {{ item.total }}
                </h2>
                <v-icon
                  icon="mdi-close"
                  size="x-small"
                />
              </div>
              <div :class="['app-avatar', { 'overlayed': isMandatory(item.id) || isSelected(item.id) }]">
                <div>
                  <v-img
                    :alt="`App ${item.id}`"
                    class="app-avatar__image"
                    cover
                    height="75"
                    lazy-src="/applogo.svg"
                    :src="item.header || `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`"
                    width="150"
                  />
                </div>
                <div v-if="isMandatory(item.id) || isSelected(item.id)">
                  <v-icon
                    color="white"
                    :icon="isMandatory(item.id) ? 'mdi-lock' : (isSelected(item.id) ? 'mdi-check' : '')"
                    size="40"
                  />
                </div>
              </div>
            </td>

            <!-- Dynamically render each column based on the headers -->
            <td
              v-for="header in headers"
              :key="header.key"
              :class="['v-data-table__td', header.key === 'links' ? 'v-data-table-column--align-end' : 'v-data-table-column--align-start']"
              :style="getTags(item).length ? { borderBottom: 'none' } : {}"
            >
              <!-- Title column -->
              <template v-if="[App.fields.title, App.fields.altTitles].includes(header.key)">
                <div
                  :class="{
                    'text-decoration-none': true,
                    'text-primary': true,
                    'text-success': inLibrary(item.id) && !inWishlist(item.id) && !inTradelist(item.id),
                    'text-error': !inLibrary(item.id) && inWishlist(item.id) && !inTradelist(item.id),
                    'text-warning': inWishlist(item.id) && inLibrary(item.id) && !inTradelist(item.id),
                    'text-info': inTradelist(item.id) && !inWishlist(item.id),
                    'text-purple': inTradelist(item.id) && inWishlist(item.id) && !inLibrary(item.id),
                  }"
                >
                  <v-list-item-title
                    v-tooltip:top="item[App.fields.title] || `Unknown App ${item.id}`"
                    class="font-weight-bold"
                  >
                    <nuxt-link
                      :class="{
                        'text-decoration-none': true,
                        'text-primary': true,
                        'text-success': inLibrary(item.id) && !inWishlist(item.id) && !inTradelist(item.id),
                        'text-error': !inLibrary(item.id) && inWishlist(item.id) && !inTradelist(item.id),
                        'text-warning': inWishlist(item.id) && inLibrary(item.id) && !inTradelist(item.id),
                        'text-info': inTradelist(item.id) && !inWishlist(item.id),
                        'text-purple': inTradelist(item.id) && inWishlist(item.id) && !inLibrary(item.id),
                      }"
                      target="_blank"
                      :to="simple ? `/app/${item.id}` : undefined"
                    >
                      {{ item[App.fields.title] || `Unknown App ${item.id}` }}
                    </nuxt-link>
                  </v-list-item-title>
                  <v-list-item-subtitle
                    v-if="item[App.fields.altTitles]?.length"
                    class="text-caption"
                  >
                    {{ item[App.fields.altTitles].join(', ') }}
                  </v-list-item-subtitle>
                </div>
              </template>

              <!-- Description column -->
              <template v-else-if="header.key === App.fields.description">
                <div
                  v-if="item[App.fields.description] !== null"
                  class="app-description"
                >
                  <v-card variant="tonal">
                    <v-card-text class="pa-2 text-caption">
                      {{ item[App.fields.description] }}
                    </v-card-text>
                  </v-card>
                </div>
                <span
                  v-else
                  class="text-disabled font-italic"
                >
                  Unknown
                </span>
              </template>

              <!-- Change number column -->
              <template v-else-if="header.key === App.fields.changeNumber">
                <a
                  class="text-decoration-none text-caption text-no-wrap"
                  :href="`https://steamdb.info/changelist/${item[App.fields.changeNumber]}/`"
                  rel="noopener"
                  style="z-index: 2;"
                  target="_blank"
                >
                  <v-icon
                    icon="mdi-history"
                    size="16"
                  />
                  {{ item[App.fields.changeNumber] }}
                </a>
              </template>

              <!-- Website column -->
              <template v-else-if="header.key === App.fields.website">
                <v-chip-group
                  class="chips"
                  :show-arrows="false"
                >
                  <v-chip
                    v-if="item[App.fields.website]"
                    :href="item[App.fields.website]"
                    prepend-icon="mdi-earth"
                    rel="noopener"
                    target="_blank"
                    :text="formatUrl(item[App.fields.website])"
                  />
                </v-chip-group>
              </template>

              <!-- Reviews columns -->
              <template v-else-if="[App.fields.positiveReviews, App.fields.negativeReviews].includes(header.key)">
                <div
                  v-if="item[App.fields.positiveReviews] !== null && item[App.fields.negativeReviews] !== null"
                  class="d-flex flex-column justify-start"
                >
                  <h2>{{ formatNumber((item[App.fields.positiveReviews] / (item[App.fields.positiveReviews] + item[App.fields.negativeReviews])) * 100) }}%</h2>
                  <small class="d-flex flex-row ga-2">
                    <span class="font-weight-bold text-success text-no-wrap">
                      <v-icon
                        icon="mdi-thumb-up"
                        size="x-small"
                      />
                      {{ formatNumber(item[App.fields.positiveReviews]) }}
                    </span>
                    <span class="font-weight-bold text-error text-no-wrap">
                      <v-icon
                        icon="mdi-thumb-down"
                        size="x-small"
                      />
                      {{ formatNumber(item[App.fields.negativeReviews]) }}
                    </span>
                  </small>
                </div>
                <span
                  v-else
                  class="text-disabled font-italic"
                >
                  Unknown
                </span>
              </template>

              <!-- Media fields (screenshots, videos) -->
              <template v-else-if="[App.fields.screenshots, App.fields.videos].includes(header.key)">
                <s-carousel
                  v-if="item[header.key]?.length"
                  :media="item[header.key]"
                  rounded
                />
              </template>

              <!-- Array fields (developers, publishers, etc.) -->
              <template v-else-if="[App.fields.developers, App.fields.publishers, App.fields.tags, App.fields.languages, App.fields.platforms].includes(header.key)">
                <v-chip-group
                  v-if="item[header.key]?.length"
                  class="chips"
                  :show-arrows="item[header.key].length > 1"
                >
                  <v-chip
                    v-for="(chip, index) in item[header.key]"
                    :key="index"
                    class="text-capitalize"
                    style="z-index: 2;"
                    :to="getCollectionLink(header.key, chip)"
                  >
                    {{ chip }}
                  </v-chip>
                </v-chip-group>
                <span
                  v-else
                  class="text-disabled font-italic"
                >
                  None
                </span>
              </template>

              <!-- Boolean fields (+1, free, exfgls) -->
              <template v-else-if="[App.fields.plusOne, App.fields.free, App.fields.exfgls].includes(header.key)">
                <v-icon
                  :color="item[header.key] === true ? 'success' : (item[header.key] === false || header.key === App.fields.plusOne ? 'error' : 'disabled')"
                  :icon="item[header.key] === true ? 'mdi-check' : (item[header.key] === false || header.key === App.fields.plusOne ? 'mdi-close' : 'mdi-help')"
                  size="x-large"
                />
                <small v-if="item.snapshot?.app?.[header.key] !== undefined && item[header.key] !== item.snapshot.app[header.key]">
                  (was <v-icon
                    :icon="item.snapshot.app[header.key] === true ? 'mdi-check' : (item.snapshot.app[header.key] === false || header.key === App.fields.plusOne ? 'mdi-close' : 'mdi-help')"
                    size="x-small"
                  />)
                </small>
              </template>

              <!-- Numeric fields -->
              <template
                v-else-if="[
                  App.fields.retailPrice,
                  App.fields.discountedPrice,
                  App.fields.marketPrice,
                  App.fields.historicalLow,
                  App.fields.cards,
                  App.fields.achievements,
                  App.fields.wishlists,
                  App.fields.tradelists,
                  App.fields.blacklists,
                  App.fields.libraries,
                  App.fields.bundles,
                  App.fields.giveaways,
                  App.fields.steamPackages,
                  App.fields.steamBundles,
                  App.fields.positiveReviews,
                  App.fields.negativeReviews
                ].includes(header.key)"
              >
                <span
                  v-if="![undefined, null].includes(item[header.key])"
                  class="d-flex flex-column justify-center"
                >
                  <!-- Prices -->
                  <div
                    v-if="[
                      App.fields.retailPrice,
                      App.fields.discountedPrice,
                      App.fields.marketPrice,
                      App.fields.historicalLow
                    ].includes(header.key)"
                    class="d-flex flex-row align-baseline"
                  >
                    <v-icon icon="mdi-currency-usd" />
                    <h2>
                      {{ formatNumber(item[header.key], 2, 2).split('.')[0] }}
                    </h2>
                    <small v-if="formatNumber(item[header.key], 2, 2).split('.')[1]">
                      .{{ formatNumber(item[header.key], 2, 2).split('.')[1].padEnd(2, '0') }}
                    </small>
                  </div>

                  <!-- Counts -->
                  <div
                    v-else
                    class="d-flex flex-row align-baseline"
                  >
                    <h2>
                      {{ formatNumber(item[header.key]) }}
                    </h2>
                  </div>

                  <!-- Historical data -->
                  <small v-if="item.snapshot?.app?.[header.key] !== undefined && item[header.key] !== item.snapshot.app[header.key]">
                    (was
                    {{
                      [
                        App.fields.retailPrice,
                        App.fields.discountedPrice,
                        App.fields.marketPrice,
                        App.fields.historicalLow
                      ].includes(header.key)
                        ? `$${formatNumber(item.snapshot.app[header.key], 2, 2)}`
                        : formatNumber(item.snapshot.app[header.key])
                    }})
                  </small>
                </span>
                <span
                  v-else-if="(header.key === App.fields.retailPrice || header.key === App.fields.discountedPrice) && item[App.fields.free]"
                  class="d-flex flex-column justify-center text-disabled"
                >
                  <div class="d-flex flex-row align-baseline">
                    <v-icon icon="mdi-currency-usd" />
                    <h2>0</h2>
                  </div>

                  <small v-if="item.snapshot?.app?.[header.key] !== undefined && item[header.key] !== item.snapshot.app[header.key]">
                    (was ${{ formatNumber(item.snapshot.app[header.key], 2, 2) }})
                  </small>
                </span>
                <span
                  v-else-if="[
                    App.fields.cards,
                    App.fields.achievements,
                    App.fields.wishlists,
                    App.fields.tradelists,
                    App.fields.blacklists,
                    App.fields.libraries
                  ].includes(header.key)"
                  class="d-flex flex-column justify-center text-disabled"
                >
                  <!-- Assume 0 by default -->
                  <h2>0</h2>
                  <small v-if="item.snapshot?.app?.[header.key] !== undefined && item[header.key] !== item.snapshot.app[header.key]">
                    (was {{ formatNumber(item.snapshot.app[header.key]) }})
                  </small>
                </span>
                <span
                  v-else
                  class="text-disabled font-italic"
                >
                  Unknown
                </span>
              </template>

              <!-- Date fields -->
              <template v-else-if="[App.fields.removedAt, App.fields.releasedAt, App.fields.updatedAt, App.fields.createdAt].includes(header.key)">
                <rich-date
                  v-if="item[header.key]"
                  :date="item[header.key]"
                  icon
                />
              </template>

              <!-- Links column -->
              <template v-else-if="header.key === 'links'">
                <v-menu
                  location="bottom"
                  offset-y
                  open-delay="0"
                  open-on-click
                  open-on-hover
                >
                  <template #activator="attrs">
                    <v-icon
                      v-bind="attrs.props"
                      icon="mdi-arrow-right h-100"
                      style="z-index: 2;"
                    />
                  </template>

                  <v-list>
                    <v-list-item
                      title="SteamKey.Trade"
                      @click="navigateTo(`/app/${item.id}`, { open: { target: '_blank' } })"
                    />
                    <v-list-item
                      v-for="(link, index) in visibleAppLinks(item)"
                      :key="index"
                      :title="link.title"
                      @click="navigateTo(getAppLink(item, link.url), { external: true, open: { target: '_blank' } })"
                    />
                  </v-list>
                </v-menu>
              </template>

              <!-- Type column -->
              <template v-else-if="header.key === App.fields.type">
                <v-chip-group
                  class="chips"
                  :show-arrows="false"
                >
                  <v-chip :to="getCollectionLink(App.fields.type, item[App.fields.type])">
                    {{ App.labels[Object.keys(App.enums.type).find(k => item[App.fields.type] === App.enums.type[k])] }}
                  </v-chip>
                </v-chip-group>
              </template>

              <!-- Default rendering for any other column -->
              <template v-else>
                {{ item[header.key] }}
              </template>
            </td>

            <nuxt-link
              v-if="!showSelect"
              class="row-link"
              :to="`/app/${item.id}`"
            />
          </tr>
          <tr :style="{ zIndex: 2, position: 'relative' }">
            <td
              v-if="getTags(item).length"
              class="pa-0 h-0"
              colspan="100%"
            >
              <v-chip-group
                class="chips mt-n5"
                :show-arrows="false"
              >
                <v-chip
                  v-for="tag in getTags(item)"
                  :key="tag.tagId"
                  class="font-weight-bold bg-yellow elevation-10"
                  :closable="item.collection[0][Collection.fields.userId] === user.id"
                  close-icon="mdi-close"
                  density="compact"
                  size="small"
                  variant="flat"
                  @click:close="deleteTag(tag)"
                >
                  {{ tagNames[tag.tagId] }}{{ tag.body ? `: ${tag.body}` : '' }}
                </v-chip>
              </v-chip-group>
            </td>
            <!-- <td
              v-else
              style="height: 16px; padding: 0;"
            /> -->
          </tr>
        </template>
      </tbody>
    </template>
  </component>
</template>

<style lang="scss" scoped>
  .app-table {
    display: flex;
    flex-grow: 1;
    overflow-x: hidden;
    overflow-y: auto;

    .row-link {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      text-indent: -9999px;       /* Hide any link text if needed */
      white-space: nowrap;        /* Prevent wrapping of hidden text */
      overflow: hidden;
      z-index: 1;                 /* Ensure link is above cell content */
      display: block;             /* Make it fill its bounding box */
    }

    ::v-deep(.v-table__wrapper > table tr > .v-data-table__td) {
      max-width: 300px;
      padding: 0 6px 0 0;
    }

    ::v-deep(.app-row) {
      &.in-blacklist {
        opacity: 0.25;
      }

      &.in-library {
        background-color: rgba(var(--v-theme-success), 0.2);
      }

      &.in-wishlist {
        background-color: rgba(var(--v-theme-error), 0.2);
      }

      &.in-tradelist {
        background-color: rgba(var(--v-theme-info), 0.2);
      }

      &.in-library.in-wishlist {
        background-color: rgba(var(--v-theme-warning), 0.2);
      }

      &.in-library.in-tradelist {
        background-color: rgba(var(--v-theme-info), 0.2);
      }

      &.in-wishlist.in-tradelist {
        background-color: rgba(purple, 0.2);
      }

      .chips {
        position: relative;
        z-index: 2;

        ::v-deep(.v-slide-group__prev),
        ::v-deep(.v-slide-group__next) {
          min-width: 0;
          flex: 0;
          padding: 0 16px;
        }
      }

      .app-avatar {
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        width: 150px;
        height: 75px;
        margin-right: 8px;

        .v-skeleton-loader__bone.v-skeleton-loader__image {
          height: 76px;
        }

        &.overlayed {
          .app-avatar__image:after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 150px;
            height: 75px;
            background: rgba(0,0,0,0.5);
          }
        }

        > div {
          position: absolute;
        }
      }

      .app-description {
        white-space: pre-wrap;
        overflow-y: scroll;
        max-height: 75px;
        min-width: 300px;
      }
    }
  }

  ::v-deep(.v-slide-group__prev--disabled),
  ::v-deep(.v-slide-group__next--disabled) {
    display: none !important;
  }
</style>
