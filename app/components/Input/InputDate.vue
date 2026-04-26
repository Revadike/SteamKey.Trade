<script setup>
  import { useDisplay } from 'vuetify';
  import { parseDate } from '~/assets/js/date';
  import { formatDate } from '~/assets/js/format';

  const {
    xs,
    smAndUp
  } = useDisplay();

  const props = defineProps({
    disabled: {
      type: Boolean,
      default: false
    },
    rules: {
      type: Array,
      default: () => ([])
    },
    range: {
      type: Boolean,
      default: false
    },
    allowedDates: {
      type: [Array, Function],
      default: undefined
    },
    minDate: {
      type: [String, Number, Date, Object],
      default: undefined
    },
    maxDate: {
      type: [String, Number, Date, Object],
      default: undefined
    },
    showTime: {
      type: Boolean,
      default: false
    },
    allowedHours: {
      type: [Array, Function],
      default: undefined
    },
    allowedMinutes: {
      type: [Array, Function],
      default: () => ([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
    },
    minTime: {
      type: String,
      default: undefined
    },
    maxTime: {
      type: String,
      default: undefined
    },
    tooltip: {
      type: String,
      default: undefined
    }
  });

  const model = defineModel({
    type: [String, Number, Date, Object, Array],
    default: null
  });

  const menu = ref(false);
  const selectedTab = ref('date');

  const proxyModel = computed({
    get: () => {
      if (props.range) {
        const dates = [];

        if (model.value?.length > 0) {
          const [
            startAt,
            endAt
          ] = model.value
            .map(parseDate)
            .filter(Boolean)
            .sort((a, b) => a.valueOf() - b.valueOf());

          dates.push(startAt);

          if (endAt) {
            const days = (endAt - startAt) / (1000 * 60 * 60 * 24);

            for (let day = 1; day < days; day++) {
              const date = new Date(startAt);
              date.setDate(date.getDate() + day);
              dates.push(date);
            }

            dates.push(endAt);
          }
        }

        return dates;
      } else {
        return parseDate(model.value);
      }
    },
    set: value => {
      if (props.range) {
        if (value.length > 0) {
          const dates = [
            new Date(value[0])
          ];

          if (value.length > 1) {
            const endDate = new Date(value[value.length - 1]);
            endDate.setHours(23, 59, 59, 999);
            dates.push(endDate);
          } else {
            const endDate = new Date(value[0]);
            endDate.setHours(23, 59, 59, 999);
            dates.push(endDate);
          }

          model.value = dates;
        } else {
          model.value = [];
        }
      } else {
        if (value) {
          if (showTime.value) {
            model.value = value;
          } else {
            const date = new Date(value);
            date.setHours(0, 0, 0, 0);
            model.value = date;
          }
        } else {
          model.value = null;
        }
      }
    }
  });

  const showTime = computed(() => !props.range && props.showTime);
  const time = computed({
    get: () => {
      if (!proxyModel.value) {
        return null;
      }

      const time = proxyModel.value ? new Date(proxyModel.value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;

      if (props.minTime) {
        const minTime = props.minTime.padStart(5, '0');

        if (minTime > time) {
          return props.minTime;
        }
      }

      return time;
    },
    set: value => {
      if (!value) {
        return;
      }

      const [
        hour,
        minute
      ] = value
        .split(':')
        .map(Number);

      const date = proxyModel.value ? new Date(proxyModel.value) : new Date();
      date.setHours(hour, minute, 0, 0);
      proxyModel.value = date;
    }
  });

  const getISOString = value => {
    const date = parseDate(value);

    if (!date) {
      return undefined;
    }

    return date.toISOString();
  };

  const minDate = computed(() => getISOString(props.minDate));
  const maxDate = computed(() => getISOString(props.maxDate));

  const formattedDate = computed(() => {
    if (!proxyModel.value || proxyModel.value?.length <= 1) {
      return;
    }

    if (props.range) {
      return [
        proxyModel.value[0],
        proxyModel.value[proxyModel.value.length - 1]
      ]
        .map(d => formatDate(d, showTime.value))
        .join(' ~ ');
    }

    return formatDate(proxyModel.value, showTime.value);
  });

  watch(menu, value => {
    if (value) {
      return;
    }

    selectedTab.value = 'date';
  });

  const onDatePickerUpdate = async () => {
    await nextTick();

    time.value = props.minTime;

    if (!props.range && !showTime.value) {
      menu.value = false;
    }
  };

</script>

<template>
  <v-menu
    v-model="menu"
    :close-on-content-click="false"
    origin="overlap"
  >
    <template #activator="{ props: menuProps }">
      <v-text-field
        :append-inner-icon="!tooltip ? 'mdi-calendar' : undefined"
        :disabled="disabled"
        :model-value="formattedDate"
        readonly
        :required="rules.length > 0"
        :rules="!disabled ? rules : []"
        v-bind="{ ...$attrs, ...menuProps }"
        @click:clear="proxyModel = range ? [] : null"
      >
        <template
          v-if="tooltip"
          #append-inner
        >
          <v-tooltip :text="tooltip" />
        </template>
      </v-text-field>
    </template>
    <v-card max-width="fit-content">
      <v-tabs
        v-if="showTime && xs"
        v-model="selectedTab"
        grow
      >
        <v-tab
          color="primary"
          value="date"
        >
          Date
        </v-tab>
        <v-tab
          color="primary"
          value="time"
        >
          Time
        </v-tab>
      </v-tabs>
      <v-window
        :model-value="showTime && smAndUp ? [ 'date', 'time' ] : selectedTab"
        touch
      >
        <v-window-item value="date">
          <v-date-picker
            v-model="proxyModel"
            :allowed-dates="allowedDates"
            :hide-header="!showTime"
            :max="maxDate"
            :min="minDate"
            :multiple="range ? 'range' : undefined"
            show-adjacent-months
            @update:model-value="onDatePickerUpdate"
          />
        </v-window-item>
        <v-window-item
          v-if="showTime"
          value="time"
        >
          <v-time-picker
            v-model="time"
            :allowed-hours="allowedHours"
            :allowed-minutes="allowedMinutes"
            class="pt-4"
            format="24hr"
            :max="maxTime"
            :min="minTime"
            title="Selecteer tijd"
          />
        </v-window-item>
      </v-window>
      <v-card-actions v-if="range || showTime">
        <v-spacer />
        <v-btn
          variant="text"
          @click="menu = false"
        >
          Ok
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<style lang="scss" scoped>
  @use 'vuetify/settings';
  @use 'vuetify/tools';

  @media (tools.breakpoint-min('sm-and-up', settings.$display-breakpoints)) {
    :deep(.v-window__container) {
      flex-direction: row;
    }
  }
</style>
