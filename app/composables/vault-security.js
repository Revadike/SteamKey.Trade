import { generateKeyPair, decrypt as passDecrypt, encrypt as passEncrypt, privateDecrypt, publicEncrypt } from '~/assets/js/crypto.js';

export const useVaultSecurity = () => {
  const { User } = useORM();
  const { user: authUser, isLoggedIn, password } = storeToRefs(useAuthStore());
  const { setPassword, setPublicKey } = useAuthStore();

  const supabase = useSupabaseClient();
  const snackbarStore = useSnackbarStore();

  const setup = async password => {
    if (!isLoggedIn.value) {
      throw new Error('User is not logged in');
    }

    const user = new User(authUser.value);

    try {
      const { privateKey, publicKey } = await generateKeyPair();
      const encryptedPrivateKey = await passEncrypt(privateKey, password);

      user.publicKey = publicKey;
      await user.save();

      const { error } = await supabase.from(User.credentials.table).insert({
        [User.credentials.fields.userId]: user.id,
        [User.credentials.fields.encryptedData]: encryptedPrivateKey.encryptedData,
        [User.credentials.fields.iv]: encryptedPrivateKey.iv
      });

      if (error) {
        throw error;
      }

      setPassword(password, 60 * 60 * 1000);
      setPublicKey(publicKey);
      snackbarStore.set('success', 'Your vault has been set up successfully.');
      return true;
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Something went wrong while setting up your vault.');
      return false;
    }
  };

  const validate = async password => {
    const control = 'control';
    const encryptedControl = await encrypt(control);
    const decryptedControl = await decrypt(encryptedControl, password);
    return decryptedControl === control;
  };

  const encrypt = (payload, publicKey = authUser.value.publicKey) => {
    return publicEncrypt(payload, publicKey);
  };

  let encryptedPrivateKey = null;
  const decrypt = async (payload, pass = password.value) => {
    try {
      if (!encryptedPrivateKey) {
        const { fields, table } = User.credentials;
        const { data, error } = await supabase
          .from(table)
          .select(`${fields.encryptedData}, ${fields.iv}`)
          .eq(fields.userId, authUser.value.id)
          .single();

        if (error) {
          throw error;
        }

        encryptedPrivateKey = {
          encryptedData: data[fields.encryptedData],
          iv: data[fields.iv]
        };
      }

      const privateKey = await passDecrypt(encryptedPrivateKey, pass);
      return privateDecrypt(payload, privateKey);
    } catch (error) {
      console.error(error);
      snackbarStore.set('error', 'Something went wrong while decrypting your vault.');
    }
  };

  return { setup, validate, encrypt, decrypt };
};