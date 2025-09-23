<script setup>
  const props = defineProps({
    userId: {
      type: String,
      required: true
    }
  });

  const emit = defineEmits(['submit']);

  const internalValue = defineModel({
    type: Boolean,
    default: false
  });
  const supabase = useSupabaseClient();
  const { Review } = useORM();
  const { user } = useAuthStore();
  const loading = ref(false);
  const valid = ref(true);

  const { data: review, status, error } = useLazyAsyncData(`user-review-${props.userId}`, async () => {
    const reviews = await Review.query(supabase, [
      { filter: 'eq', params: [Review.fields.subjectId, props.userId] },
      { filter: 'eq', params: [Review.fields.userId, user.id] }
    ]);

    if (reviews.length) {
      return reviews[0].toObject();
    }

    return {
      ...new Review().toObject(),
      userId: user.id,
      subjectId: props.userId
    };
  });

  const snackbarStore = useSnackbarStore();
  watch(() => error.value, error => {
    if (error) {
      snackbarStore.set('error', 'Failed to load review');
    }
  });

  const submit = async () => {
    if (!valid.value) {
      snackbarStore.set('error', 'Please fill out all required fields');
      return;
    }

    loading.value = true;

    try {
      review.value.body = review.value.body || null; // Ensure body is null if empty
      const instance = new Review(review.value.id ?? undefined);
      Object.assign(instance, review.value);
      await instance.save();
      review.value = instance.toObject();
      emit('submit');
      snackbarStore.set('success', 'Review submitted');
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Failed to submit review');
    }

    loading.value = false;
    internalValue.value = false;
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
    <v-card :loading="loading || status === 'loading'">
      <v-form
        v-model="valid"
        @submit.prevent="submit"
      >
        <v-card-title>
          <span>
            Review of
            <rich-profile-link
              class="ml-2"
              :user-id="props.userId"
            />
          </span>
        </v-card-title>
        <v-card-text v-if="review">
          <p class="mb-8">
            Rate your <strong>honest</strong> experience with this user.
          </p>
          <v-row
            v-for="key in Review.enums.metric"
            :key="key"
          >
            <v-col
              v-tooltip:left="Review.descriptions[key]"
              class="d-flex align-center justify-start"
              cols="12"
              md="4"
            >
              <v-icon
                class="mr-2"
                :icon="Review.icons[key]"
                :size="32"
              />
              <strong>{{ Review.labels[key] }}:</strong>
            </v-col>
            <v-col
              class="d-flex align-end justify-center"
              cols="12"
              md="8"
            >
              <v-rating
                v-model="review[key]"
                class="rating"
                color="yellow"
                density="compact"
                hover
                :item-labels="[Review.labels.min[key], '', '', '', Review.labels.max[key]]"
                :length="5"
                :rules="[ v => !!v || 'Required' ]"
                size="32"
              />
            </v-col>
          </v-row>
          <v-expansion-panels>
            <v-expansion-panel
              bg-color="secondary"
              class="mt-6 review-body"
              elevation="0"
              static
            >
              <v-expansion-panel-title>
                <v-icon
                  icon="mdi-note-edit"
                  start
                />
                <strong>{{ Review.labels.body }}:</strong>
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-textarea
                  v-model="review.body"
                  auto-grow
                  autofocus
                  clearable
                  hide-details
                  :placeholder="Review.descriptions.body"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
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
            :disabled="!valid"
            type="submit"
            variant="tonal"
          >
            Submit
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped>
  .rating {
    ::v-deep(.v-rating__wrapper > span) {
      font-size: .8rem;
      margin-top: -1rem;
      opacity: .6;
      position: absolute;
    }
  }

  .review-body {
    ::v-deep(.v-expansion-panel-text__wrapper) {
      padding: 0;
    }
  }
</style>