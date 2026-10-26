/**
 * Predefined profile avatars. The id is what gets stored server-side
 * (validated against /^[a-z0-9-]{1,64}$/), and the gradient is render-only so
 * unknown ids can never inject classes.
 */
const AVATARS = [
  { id: 'sunrise', label: 'Sunrise', gradient: 'from-amber-400 to-pink-500' },
  { id: 'ocean', label: 'Ocean', gradient: 'from-sky-400 to-indigo-500' },
  { id: 'forest', label: 'Forest', gradient: 'from-emerald-400 to-teal-600' },
  { id: 'lavender', label: 'Lavender', gradient: 'from-violet-400 to-purple-600' },
  { id: 'ember', label: 'Ember', gradient: 'from-orange-500 to-rose-600' },
  { id: 'mint', label: 'Mint', gradient: 'from-lime-400 to-emerald-500' },
  { id: 'dusk', label: 'Dusk', gradient: 'from-fuchsia-500 to-indigo-600' },
  { id: 'slate', label: 'Slate', gradient: 'from-slate-500 to-slate-700' },
  { id: 'bubblegum', label: 'Bubblegum', gradient: 'from-pink-400 to-fuchsia-500' },
  { id: 'gold', label: 'Gold', gradient: 'from-yellow-400 to-amber-600' },
  { id: 'arctic', label: 'Arctic', gradient: 'from-cyan-400 to-blue-500' },
  { id: 'storm', label: 'Storm', gradient: 'from-zinc-500 to-blue-800' },
];

const byId = new Map(AVATARS.map((avatar) => [avatar.id, avatar]));

export function listAvatars() {
  return AVATARS;
}

/** Never trust the stored id for rendering; fall back to the initial letter. */
export function getAvatar(id) {
  return byId.get(id) ?? null;
}
