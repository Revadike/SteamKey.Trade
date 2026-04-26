<script setup>
  defineProps({
    image: {
      type: String,
      required: true
    },
    eager: {
      type: Boolean,
      default: false
    },
    preloader: {
      type: Boolean,
      default: false
    },
    preloaderColor: {
      type: String,
      default: 'primary'
    },
    contain: {
      type: Boolean,
      default: false
    },
    containPosition: {
      type: String,
      default: 'center',
      validator: v => [
        'left top',
        'left',
        'left bottom',
        'top',
        'center',
        'bottom',
        'right top',
        'right',
        'right bottom'
      ].includes(v)
    },
    sizes: {
      type: String,
      default: ''
    },
    srcset: {
      type: String,
      default: ''
    }
  });
</script>

<template>
  <v-img
    :cover="!contain"
    :position="containPosition"
    :sizes="sizes"
    :src="image"
    :srcset="srcset"
  >
    <template
      v-if="preloader"
      #placeholder
    >
      <div class="d-flex align-center justify-center fill-height">
        <v-progress-circular
          :color="preloaderColor"
          indeterminate
        />
      </div>
    </template>
    <slot />
  </v-img>
</template>
