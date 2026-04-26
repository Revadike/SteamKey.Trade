import debounce from 'lodash/debounce';

export function useDebouncedRef(initialValue, delay = 300) {
  const state = ref(initialValue);

  return customRef((track, trigger) => ({
    get() {
      track();
      return state.value;
    },
    set: debounce((value) => {
      state.value = value;
      trigger();
    }, delay)
  }));
}