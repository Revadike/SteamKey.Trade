<script setup>
  import debounce from 'lodash/debounce';

  defineProps({
    title: {
      type: String,
      default: 'Select user'
    },
    selectText: {
      type: String,
      default: 'Select'
    }
  });

  const emit = defineEmits(['select:user']);

  const snackbarStore = useSnackbarStore();
  const supabase = useSupabaseClient();
  const { User } = useORM();
  const { user: authUser } = useAuthStore();
  const selectedUser = ref(null);
  const internalValue = ref(false);
  const suggestions = ref([]);
  const loading = ref(false);

  const { data: partners } = await useSupabaseData('user-partners', { id: authUser.id });

  const fetchSuggestions = async (query) => {
    if (!query || suggestions.value.find(({ title }) => title === query)) {
      return;
    }

    loading.value = true;
    const { error, data } = await supabase
      .from(User.table)
      .select(`${User.fields.id}, ${User.fields.displayName}, ${User.fields.avatar}`)
      .ilike(User.fields.displayName, `%${query}%`)
      .limit(100);

    if (error) {
      console.error(error);
      snackbarStore.set('error', 'Failed to fetch users');
    } else {
      suggestions.value = data;
    }

    loading.value = false;
  };

  // Debounced version of fetchSuggestions
  const debouncedFetchSuggestions = debounce(fetchSuggestions, 300);

  // Handler for search input updates
  const onSearch = (searchTerm) => {
    debouncedFetchSuggestions(searchTerm);
  };

  const selectUser = (userId = selectedUser.value) => {
    internalValue.value = false;
    emit('select:user', userId);
  };
</script>

<template>
  <v-dialog
    v-model="internalValue"
    width="500"
  >
    <template #activator="attrs">
      <slot
        name="activator"
        v-bind="attrs"
      />
    </template>
    <v-card :loading="loading">
      <v-card-title>
        {{ title }}
      </v-card-title>
      <v-card-text>
        <v-autocomplete
          v-model="selectedUser"
          auto-select-first
          clearable
          hide-no-data
          :item-title="User.fields.displayName"
          :item-value="User.fields.id"
          :items="suggestions"
          label="Search"
          :loading="loading"
          placeholder="Type to search..."
          @update:search="onSearch"
        >
          <template #item="{ item, props }">
            <v-list-item
              v-bind="props"
              :title="item.raw[User.fields.displayName]"
            >
              <template #prepend>
                <v-avatar>
                  <rich-image
                    v-if="item.raw[User.fields.avatar]"
                    :alt="item.raw[User.fields.displayName]"
                    contain
                    :image="item.raw[User.fields.avatar]"
                    :title="item.raw[User.fields.displayName]"
                  />
                  <v-icon
                    v-else
                    icon="mdi-account"
                  />
                </v-avatar>
              </template>
            </v-list-item>
          </template>
        </v-autocomplete>

        <span
          v-if="partners.length"
          class="mt-2 mr-2"
        >
          <v-icon
            class="mr-1"
            icon="mdi-account-multiple"
          />
          Suggested users:
        </span>
        <span
          v-for="(item, i) in partners"
          :key="item.partnerId"
          class="cursor-pointer"
          @click.capture="selectUser(item.partnerId)"
        >
          <rich-profile-link
            :avatar-size="24"
            no-link
            :user-id="item.partnerId"
          />
          {{ i === partners.length - 1 ? '' : ',' }}
        </span>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn
          variant="text"
          @click="internalValue = false"
        >
          Cancel
        </v-btn>
        <v-spacer />
        <v-btn
          :disabled="!selectedUser"
          variant="tonal"
          @click="selectUser(selectedUser)"
        >
          {{ selectText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
