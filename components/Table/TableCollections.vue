<script setup>
  import TableData from './TableData.vue';
  import { VDataTableVirtual } from 'vuetify/components';

  import { formatNumber } from '~/assets/js/format';

  const { Collection } = useORM();
  const supabase = useSupabaseClient();
  const { isLoggedIn, user } = storeToRefs(useAuthStore());

  const { sync: syncWishlist, loading: loadingWishlist } = useSteamSync(Collection.enums.type.wishlist);
  const { sync: syncLibrary, loading: loadingLibrary } = useSteamSync(Collection.enums.type.library);

  const table = ref(null);
  const props = defineProps({
    items: {
      type: Array,
      default: null
    },
    onlyUsers: {
      type: Array,
      default: null
    },
    excludeUsers: {
      type: Array,
      default: null
    },
    onlyCollections: {
      type: Array,
      default: null
    },
    onlyApps: {
      type: Array,
      default: null
    },
    onlyTypes: {
      type: Array,
      default: null
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
    showActions: {
      type: Boolean,
      default: false
    },
    showQuickFilters: {
      type: Boolean,
      default: false
    },
    maxSelection: {
      type: Number,
      default: null
    },
    defaultSortBy: {
      type: Array,
      default: () => []
    },
    rowLink: {
      type: [String, Object, Function],
      default: null
    }
  });

  watch([
    () => props.onlyUsers,
    () => props.excludeUsers,
    () => props.onlyCollections,
    () => props.onlyTypes
  ], () => table.value?.refresh?.());

  const isMine = computed(() => isLoggedIn.value && props.onlyUsers?.length === 1 && props.onlyUsers?.[0] === user.value.id);
  const queryGetter = () => {
    let query = supabase
      .from(Collection.table)
      .select(`*,
      apps:${Collection.apps.table}(count),
      applist:${Collection.apps.table}${props.onlyApps?.length ? '!inner' : ''}(${Collection.apps.fields.appId}),
      subcollections:${Collection.relations.table}!${Collection.relations.fields.parentId}(count)
    `);

    if (props.onlyUsers?.length) {
      query = query.in(Collection.fields.userId, props.onlyUsers);
    }

    if (props.excludeUsers?.length) {
      query = query.or(`${Collection.fields.userId}.is.null,${Collection.fields.userId}.not.in.(${props.excludeUsers.join(',')})`);
    }

    if (props.onlyCollections?.length) {
      query = query.in(Collection.fields.id, props.onlyCollections);
    }

    if (props.onlyApps?.length) {
      query = query.in(`applist.${Collection.apps.fields.appId}`, props.onlyApps);
    }

    if (props.onlyTypes?.length) {
      query = query.in(Collection.fields.type, props.onlyTypes);
    }

    if (!isMine.value) {
      query = query.eq(Collection.fields.private, false);
    }

    return query;
  };

  const headers = [
    { title: Collection.labels.type, value: Collection.fields.type, sortable: true, align: 'center' },
    { title: Collection.labels.master, value: Collection.fields.master, sortable: false, align: 'center' },
    { title: Collection.labels.title, value: Collection.fields.title, sortable: true },
    { title: Collection.labels.description, value: Collection.fields.description, sortable: false },
    { title: Collection.labels.apps, value: 'apps', sortable: false },
    { title: Collection.labels.subcollections, value: 'subcollections', sortable: false },
    { title: Collection.labels.updatedAt, value: Collection.fields.updatedAt, sortable: true, align: 'end' },
    ...(props.showActions ? [{ title: '', value: 'actions', sortable: false, align: 'end' }] : [])
  ];

  const mapItem = async (item) => {
    return {
      ...item,
      ...(item.apps?.[0] ? { apps: item.apps[0].count || 0 } : {}),
      ...(item.subcollections?.[0] ? { subcollections: item.subcollections[0].count || 0 } : {})
    };
  };

  const collectionTypes = Object.entries(Collection.enums.type).map(([key, value]) => ({
    title: Collection.labels[key],
    value
  }));

  const filters = [
    { title: Collection.labels.type, value: Collection.fields.type, type: String, options: collectionTypes },
    { title: Collection.labels.userId, value: Collection.fields.userId, type: String }, // TODO: Add user search
    { title: Collection.labels.master, value: Collection.fields.master, type: Boolean },
    { title: Collection.labels.startsAt, value: Collection.fields.startsAt, type: Date },
    { title: Collection.labels.endsAt, value: Collection.fields.endsAt, type: Date },
    { title: Collection.labels.updatedAt, value: Collection.fields.updatedAt, type: Date },
    { title: Collection.labels.createdAt, value: Collection.fields.createdAt, type: Date }
  ];

  const quickFilters = [
    {
      title: 'Currently active',
      value: [{
        field: Collection.fields.startsAt,
        operation: 'lte',
        value: new Date().toISOString()
      }, {
        field: Collection.fields.endsAt,
        operation: 'gte',
        value: new Date().toISOString()
      }]
    },
    {
      title: 'Upcoming',
      value: [{
        field: Collection.fields.startsAt,
        operation: 'gt',
        value: new Date().toISOString()
      }]
    },
    ...collectionTypes.map(({ title, value }) => ({
      title,
      value: [{
        field: Collection.fields.type,
        operation: 'eq',
        value
      }]
    }))
  ];

  const attrs = useAttrs();

  // Determine which table component to use based on the presence of items.
  const component = computed(() =>
    props.items ? VDataTableVirtual : TableData
  );

  const tableProps = computed(() => {
    const baseProps = {
      headers,
      mapItem,
      maxSelection: props.maxSelection,
      multiple: true,
      mustSort: true,
      noDataText: 'No collections found',
      returnObject: true,
      rowLink: rowLinkGetter.value,
      simple: props.simple,
      showSelect: props.showSelect,
      sortBy: [{ key: Collection.fields.updatedAt, order: 'desc' }],
      defaultSortBy: props.defaultSortBy
    };

    if (props.items) {
      return {
        ...baseProps,
        items: props.items.map(item => ({
          ...Collection.toDB(item),
          subcollections: item.subcollections,
          apps: item.apps
        })),
        headerProps: { class: 'text-overline', style: { lineHeight: 1.5 } }
      };
    } else {
      return {
        ...baseProps,
        ...attrs,
        queryGetter,
        searchField: Collection.fields.title,
        filters
      };
    }
  });

  const rowLinkGetter = computed(() => {
    if (props.rowLink) {
      return props.rowLink;
    }
    if (props.showSelect) {
      return null;
    }
    return (item) => `/collection/${item.id}`;
  });

  const toggleSelected = (item) => {
    const modelValue = Array.isArray(attrs.modelValue) ? [...attrs.modelValue] : [];
    const index = modelValue.findIndex(entry => (entry?.id || entry) === item.id);

    if (index >= 0) {
      modelValue.splice(index, 1);
    } else {
      modelValue.push(item);
    }

    const updateModel = attrs['onUpdate:modelValue'];
    if (typeof updateModel === 'function') {
      updateModel(modelValue);
    }
  };

  const tableEvents = computed(() => {
    if (props.showSelect && !props.rowLink) {
      return props.items
        ? { 'click:row': (_, { item }) => toggleSelected(toRaw(item)) }
        : { 'click:row': (item) => toggleSelected(item) };
    }
    return {};
  });

  const deleteCollection = async (item) => {
    await supabase.from(Collection.table).delete().eq(Collection.fields.id, item.id);
    table.value?.refresh?.();
  };
</script>

<template>
  <component
    :is="component"
    ref="table"
    v-bind="{ ...tableProps }"
    :show-select=" props.showSelect ? '' : undefined"
    v-on="tableEvents"
  >
    <template
      v-if="showQuickFilters && !props.items"
      #top
    >
      <s-quick-filters :filters="quickFilters" />
    </template>

    <template #[`item.${Collection.fields.type}`]="{ item }">
      <v-icon
        v-tooltip:top="Collection.labels[item.type]"
        :icon="Collection.icons[item.type]"
      />
    </template>

    <template #[`item.${Collection.fields.master}`]="{ item }">
      <v-icon
        :color="item.master ? 'success' : 'grey'"
        :icon="item.master ? 'mdi-check' : 'mdi-close'"
      />
    </template>

    <template
      v-for="field in ['apps', 'subcollections']"
      :key="field"
      #[`item.${field}`]="{ item }"
    >
      <v-chip
        small
        :text="formatNumber(item[field])"
      />
    </template>

    <template #[`item.${Collection.fields.updatedAt}`]="{ item }">
      <rich-date
        v-if="item[Collection.fields.updatedAt]"
        :date="item[Collection.fields.updatedAt]"
      />
      <span v-else>Never</span>
    </template>

    <template #[`item.actions`]="{ item }">
      <v-menu
        v-if="isLoggedIn && item[Collection.fields.userId] === user.id"
        :close-on-content-click="false"
      >
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            icon="mdi-dots-vertical"
            :ripple="false"
            variant="plain"
          />
        </template>
        <v-list>
          <v-list-item @click="navigateTo(`/collection/${item.id}/edit`)">
            <v-list-item-title>
              <v-icon
                class="mr-1"
                icon="mdi-pencil"
                size="small"
              />
              Edit
            </v-list-item-title>
          </v-list-item>
          <dialog-confirm
            color="error"
            confirm-text="Delete"
            title="Delete Collection"
            @confirm="deleteCollection(item)"
          >
            <template #activator="{ props: dialogProps }">
              <v-list-item v-bind="dialogProps">
                <v-list-item-title>
                  <v-icon
                    class="mr-1"
                    icon="mdi-delete"
                    size="small"
                  />
                  Delete
                </v-list-item-title>
              </v-list-item>
            </template>
            <template #body>
              <div class="pa-4">
                Are you sure you want to delete this collection?
                This action cannot be undone.
              </div>
            </template>
          </dialog-confirm>
          <v-list-item
            v-if="item.master && (item.type === Collection.enums.type.wishlist || item.type === Collection.enums.type.library)"
            @click="item.type === Collection.enums.type.wishlist ? syncWishlist() : syncLibrary()"
          >
            <v-list-item-title>
              <v-progress-circular
                v-if="loadingWishlist || loadingLibrary"
                class="mr-1"
                color="primary"
                indeterminate
                size="16"
              />
              <v-icon
                v-else
                class="mr-1"
                icon="mdi-sync"
                size="small"
              />
              Sync with Steam
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </template>
  </component>
</template>
