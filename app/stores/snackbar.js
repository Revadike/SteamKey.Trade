/**
 * Store for the snackbar component.
 *
 * @type {StoreDefinition<"snackbar", {
 *   visible: boolean,
 *   message: string,
 *   type: string
 * }>}
 */
export const useSnackbarStore = defineStore('snackbar', () => {
  const visible = ref(false);
  const message = ref('');
  const type = ref('info');
  const timeout = ref(null);

  /**
   * Set the snackbar message and type.
   *
   * @param {string} snackbarType - The type of the snackbar (e.g., 'info', 'success', 'error').
   * @param {string} snackbarMessage - The message to display in the snackbar.
   * @param {number|null} snackbarTimeout - The duration in milliseconds before the snackbar disappears. If null, it will not disappear automatically.
   */
  function set(snackbarType = 'info', snackbarMessage = '', snackbarTimeout = null) {
    visible.value = false;
    message.value = snackbarMessage;
    type.value = snackbarType;
    visible.value = true;
    timeout.value = parseInt(snackbarTimeout) || null;
  }

  return {
    visible,
    message,
    type,
    timeout,
    set
  };
});
