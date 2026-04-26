/**
 * Read as data url
 *
 * @param {File} file
 *
 * @returns {Promise<?string>}
 */
export const readAsDataUrl = file => {
  if (!(file instanceof File)) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', ({ target }) => {
      resolve(target.result);
    }, false);
    reader.addEventListener('error', reject, false);
    reader.readAsDataURL(file);
  });
};
