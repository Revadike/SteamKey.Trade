export const toAccountID = steamid => {
  let [str, lower32] = [steamid, 0];

  for (let index = 0; str.length > 0; index++) {
    let num = 0;
    const result = [];

    for (let i = 0; i < str.length; i++) {
      num = num + Number(str[i]);
      const r = Math.floor(num / 2);
      num = (num - (2 * r)) * 10;
      if (r !== 0 || result.length > 0) { result.push(r); }
    }

    str = result.join('');
    if (num > 0 && index < 32) {
      lower32 |= (1 << index);
    }
  }

  return ((lower32 & (((1 << 31) - 1) << 1)) >> 1) << 1 | (lower32 & 1);
};