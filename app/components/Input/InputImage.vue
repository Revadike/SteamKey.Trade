<script setup>
  import { readAsDataUrl } from '~/assets/js/file';
  import { isAspectRatio, isNumeric } from '~/assets/js/validate';

  const props = defineProps({
    modelValue: {
      type: Object,
      default: () => ({})
    },
    label: {
      type: String,
      default: undefined
    },
    disabled: {
      type: Boolean,
      default: false
    },
    rules: {
      type: Array,
      default: () => ([])
    },
    previewWidth: {
      type: [Number, String],
      default: '200px'
    },
    aspectRatio: {
      type: String,
      default: null,
      validator: isAspectRatio
    },
    cropped: {
      type: Boolean,
      default: false
    },
    cropperEager: {
      type: Boolean,
      default: true
    },
    accepts: {
      type: Array,
      default: () => ([
        'image/jpeg',
        'image/png',
        'image/svg+xml'
      ]),
      validator: v => v.every(v => v.startsWith('image/'))
    }
  });

  const inputId = useId();

  let timeoutId;
  let cropper;

  const internalValue = defineModel({
    type: Object
  });

  internalValue.value = props.modelValue;

  const overDropzone = ref(false);
  const preview = ref(null);
  const file = ref(null);
  const accept = computed(() => props.accepts.join(','));
  const width = computed(() => isNumeric(props.previewWidth) ? `${props.previewWidth}px` : props.previewWidth);

  const onFile = async ({ target }) => {
    const [file] = target.files;

    target.value = null;

    if (!file || !props.accepts.includes(file.type)) {
      return;
    }

    internalValue.value = {
      ...internalValue.value,
      url: await readAsDataUrl(file),
      file
    };
  };

  const dragEnter = event => {
    const { types } = event.dataTransfer;

    if (!types.includes('Files')) {
      return event.preventDefault();
    }

    overDropzone.value = true;
  };

  const dropFile = async event => {
    await onFile({
      target: {
        files: Array.from(event.dataTransfer.files)
      }
    });

    overDropzone.value = false;
  };

  const initCropper = async () => {
    if (cropper || !preview.value) {
      return;
    }

    await import(/* webpackChunkName: 'cropper' */'cropperjs/dist/cropper.css');

    const { default: Cropper } = await import(/* webpackChunkName: 'cropper' */'cropperjs/dist/cropper.esm');

    const [width, height] = props.aspectRatio.split(':');

    cropper = new Cropper(preview.value, {
      viewMode: 1,
      aspectRatio: width && height ? (width / height) : NaN,
      autoCropArea: 1,
      dragMode: 'none',
      background: false,
      movable: false,
      zoomable: false,
      checkOrientation: true,
      // Rotatable and scalable are required for orientation check.
      rotatable: true,
      scalable: true,
      // Default specified by plugin is 200.
      minContainerWidth: parseInt(props.previewWidth) || 200,

      ready: () => {
        const { crop } = internalValue.value ?? {};

        if (crop) {
          const { x, y, width, height } = crop;

          const {
            naturalWidth,
            naturalHeight
          } = cropper.getImageData();

          if (x >= 0 && y >= 0 && width <= naturalWidth && height <= naturalHeight) {
            cropper.setData({ x, y, width, height });
          }
        }
      },

      crop: event => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
          const {
            rotate,
            x,
            y,
            width,
            height
          } = event.detail;

          internalValue.value = {
            ...internalValue.value,
            crop: {
              rotate,
              x: Math.round(x),
              y: Math.round(y),
              width: Math.round(width),
              height: Math.round(height)
            }
          };
        }, 200);
      }
    });
  };

  const destroy = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (cropper) {
      cropper.destroy();
    }

    timeoutId = null;
    cropper = null;

    internalValue.value = {
      ...internalValue.value,
      url: '',
      file: null,
      ...(props.cropped ? { crop: {} } : {})
    };
  };

  watch(() => internalValue.value?.url, async url => {
    if (!url) {
      return;
    }

    await nextTick();

    if (cropper) {
      cropper.replace(url);
      cropper.reset();
    } else {
      await initCropper();
    }
  });

  watch(() => props.aspectRatio, ({ value }) => {
    if (cropper) {
      const [width, height] = value.split(':');

      cropper.setAspectRatio(width / height);
    }
  });

  watch(() => props.disabled, ({ value }) => {
    if (cropper) {
      cropper[value ? 'disable' : 'enable']();
    }
  });

  watch(() => props.cropped, async ({ value }) => {
    if (value) {
      await initCropper();
    }
  });

  onMounted(async () => {
    if (props.cropperEager) {
      await initCropper();
    }
  });

  onUnmounted(() => destroy());
</script>

<template>
  <div>
    <span v-if="label">
      {{ label }}
    </span>
    <v-input
      :id="inputId"
      v-model="internalValue"
      class="input-image"
      :disabled="disabled"
      :required="rules.length > 0"
      :rules="!disabled ? rules : []"
    >
      <div
        :id="inputId"
        class="input-image__slot"
      >
        <div
          class="input-image__dropzone"
          :style="{ width }"
          @dragenter="dragEnter"
        >
          <v-fade-transition>
            <div
              v-show="overDropzone"
              class="input-image__dropzone-overlay"
              @dragleave="overDropzone = false"
              @dragover.prevent
              @drop.prevent="dropFile"
            >
              <v-icon
                color="white"
                size="large"
              >
                mdi-cloud-upload
              </v-icon>
            </div>
          </v-fade-transition>
          <div class="input-image__preview">
            <div class="input-image__image">
              <img
                v-if="internalValue?.url"
                ref="preview"
                alt="Preview"
                :src="internalValue.url"
              >
            </div>
          </div>
        </div>
        <div class="input-image__actions">
          <v-btn
            aria-label="Afbeelding toevoegen"
            :disabled="disabled"
            icon="mdi-plus"
            title="Toevoegen"
            @click="file.click()"
          />
          <v-btn
            v-if="internalValue?.url"
            aria-label="Afbeelding verwijderen"
            :disabled="disabled"
            icon="mdi-close"
            title="Verwijderen"
            @click="destroy"
          />
        </div>
        <input
          ref="file"
          :accept="accept"
          type="file"
          @change="onFile"
        >
      </div>
    </v-input>
  </div>
</template>

<style lang="scss" scoped>
  .input-image {
    .v-input::v-deep( > .v-input__control > .v-input__slot) {
      flex-direction: column;
      align-items: flex-start;

      & + .v-messages {
        padding: 0 12px;
        margin-bottom: 8px;
      }
    }
  }

  .input-image__slot {
    display: flex;
    flex: 1 1 auto;

    width: 100%;

    padding-top: 4px;

    input[type=file] {
      display: none;
    }
  }

  .input-image__dropzone {
    display: flex;

    position: relative;
  }

  .input-image__dropzone-overlay {
    display: flex;
    align-items: center;
    justify-content: center;

    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 1;

    background: rgba(black, .4);

    .v-icon {
      pointer-events: none;
    }
  }

  .input-image__preview {
    flex: 1 1 auto;

    user-select: none;
  }

  .input-image__image {
    position: relative;

    padding-top: 100%;

    background: {
      color: white;
      image: linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%, #ddd), linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%, #ddd);
      position: 0 0, .625rem .625rem;
      size: 1.25rem 1.25rem;
      repeat: repeat;
    }

    > img,
    ::v-deep(.cropper-container) {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
    }

    > img {
      display: block;

      max-width: 100%;
      max-height: 100%;

      width: auto;
      height: auto;

      margin: auto;
    }
  }

  .input-image__actions {
    display: flex;
    flex-direction: column;

    margin-left: 4px;

    .v-btn + .v-btn {
      margin-top: 4px;
    }
  }
</style>
