<script setup>
  const props = defineProps({
    apps: {
      type: Array,
      default: () => []
    },
    collectionType: {
      type: String,
      required: true
    }
  });

  const emit = defineEmits(['submit']);

  const internalValue = ref(false);
  const loading = ref(false);
  const supabase = useSupabaseClient();
  const { Collection } = useORM();
  const tagsStore = useTagsStore();
  const snackbarStore = useSnackbarStore();

  const selectedTag = ref(null);
  const tagBody = ref('');

  const availableTags = computed(() => {
    return tagsStore.getNames(props.collectionType);
  });

  const tagItems = computed(() => {
    return Object.entries(availableTags.value).map(([id, title]) => ({
      value: Number(id),
      title
    }));
  });

  const submit = async () => {
    if (!selectedTag.value) {
      snackbarStore.set('warning', 'No tag selected');
      return;
    }

    loading.value = true;
    try {
      const tags = [];
      // Create tag entries for each app and the selected tag
      props.apps.forEach(app => {
        tags.push({
          collectionId: app.collection[0][Collection.tags.fields.collectionId],
          appId: app.id,
          tagId: selectedTag.value,
          body: tagBody.value || null
        });
      });

      // Insert tags using bulk insert
      const { error } = await supabase.rpc('bulk_insert', {
        p_table: Collection.tags.table,
        p_records: tags.map(tag => Collection.toDB(tag, Collection.tags.fields))
      });

      if (error) {
        throw error;
      }

      emit('submit');
      snackbarStore.set('success', `Tag added to ${props.apps.length} apps`);
      internalValue.value = false;
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', error.message || 'Failed to add tag');
    }
    loading.value = false;
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
        <v-icon
          class="mr-2"
          icon="mdi-tag-plus"
          size="24"
        />
        <span>Add tag</span>
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12">
            <v-select
              v-model="selectedTag"
              hide-details
              item-title="title"
              item-value="value"
              :items="tagItems"
              label="Tag"
            />
          </v-col>
        </v-row>

        <!-- Allow adding a body/note for the tag -->
        <v-row v-if="selectedTag">
          <v-col cols="12">
            <v-text-field
              v-model="tagBody"
              hide-details
              label="Optional value"
            />
          </v-col>
        </v-row>
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
          :disabled="!selectedTag"
          variant="tonal"
          @click="submit"
        >
          Add to {{ props.apps.length }} apps
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>