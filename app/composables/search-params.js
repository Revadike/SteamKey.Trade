/**
 * A composable function to synchronize a reactive parameter with the URL query string.
 * This function allows you to manage a specific query parameter in the URL, providing
 * default values and transformation options for both reading from and writing to the URL.
 *
 * @param {string} paramKey - The key of the query parameter to manage.
 * @param {*} [defaultValue=null] - The default value to use if the parameter is not present in the URL.
 * @param {Object} [options={}] - Optional transformation functions for the parameter.
 * @param {Function} [options.get] - A function to transform the value from the URL to the internal value.
 *                                    Defaults to an identity function.
 * @param {Function} [options.set] - A function to transform the internal value to the URL format.
 *                                    Defaults to an identity function.
 * @returns {import('vue').Ref} - A reactive reference to the parameter value, synchronized with the URL.
 *
 * @example
 * // Basic usage
 * const searchTerm = useSearchParam('search', '');
 *
 * // With transformation functions
 * const page = useSearchParam('page', 1, {
 *   get: (val) => parseInt(val, 10),
 *   set: (val) => val.toString()
 * });
 *
 * // Reactive updates
 * searchTerm.value = 'new search'; // Updates the URL
 * console.log(searchTerm.value); // Logs the current value from the URL or default
 */
export const useSearchParam = (paramKey, defaultValue = null, options = {}) => {
  const router = useRouter();
  const route = useRoute();

  // Default transformation functions
  const defaultOptions = {
    // Transform the value from URL to the internal value
    get: val => val,
    // Transform the internal value to URL format
    set: val => val
  };

  // Merge default and provided options
  const mergedOptions = { ...defaultOptions, ...options };

  // Initialize with value from URL or default
  const getValue = () => {
    if (route.query[paramKey] !== undefined) {
      return mergedOptions.get(route.query[paramKey]);
    }

    return defaultValue;
  };

  // Create a reactive reference with initial value from URL or default
  const param = ref(getValue());

  // Watch for changes in the URL parameter
  watch(() => route.query[paramKey], (newValue) => {
    if (newValue !== undefined) {
      param.value = mergedOptions.get(newValue);
    } else if (defaultValue !== undefined) {
      param.value = defaultValue;
    }
  });

  // Watch for changes in the local value and update URL
  watch(param, (newValue) => {
    const newQuery = { ...route.query };

    if (newValue === null || newValue === undefined
      || (Array.isArray(newValue) && newValue.length === 0)
      || (typeof newValue === 'string' && newValue === '')) {
      // Remove parameter from URL if it's empty
      delete newQuery[paramKey];
    } else {
      // Always set the parameter in URL, even if it's the default value
      newQuery[paramKey] = mergedOptions.set(newValue);
    }

    // Only trigger router change if the query actually changed
    const currentVal = route.query[paramKey];
    const newVal = newQuery[paramKey];
    if (currentVal !== newVal) {
      router.replace({ query: newQuery }, { shallow: true });
    }
  });

  return param;
};
