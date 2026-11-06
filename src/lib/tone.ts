/**
 * A colour slot (0 to 5) for a name, so the same batch always looks the same and different batches differ.
 * Names get slots in the order they are registered (registerTones sorts them first, so the order is steady);
 * a name nobody registered takes the next free slot.
 */
const slots = new Map<string, number>();

export const registerTones = (names: string[]) => {
  for (const name of [...new Set(names)].sort())
    if (!slots.has(name)) slots.set(name, slots.size % 6);
};

export const toneOf = (text: string) => {
  const known = slots.get(text);
  if (known !== undefined) return known;
  const next = slots.size % 6;
  slots.set(text, next);
  return next;
};
