/** A steady colour slot (0 to 5) for a name, so the same dancer or batch always looks the same. */
export const toneOf = (text: string) => {
  let sum = 0;
  for (const ch of text) sum = (sum * 31 + ch.charCodeAt(0)) % 6;
  return sum;
};
