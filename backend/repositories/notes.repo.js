const crypto = require('crypto');

const { sanitizeNote } = require('../lib/sanitize');
const { toNoteDTO } = require('../lib/dto');

const COLUMNS = 'id,title,content,tags,pinned,archived,created_at,updated_at';

/**
 * Notes repository bound to one signed-in user.
 *
 * `supabase` is the request-scoped client (anon key + the user's access token),
 * so RLS applies. Every query also filters by user_id as defence in depth.
 */
function createNotesRepo({ supabase, userId } = {}) {
  if (!supabase) throw new Error('createNotesRepo requires a Supabase client');
  if (!userId) throw new Error('createNotesRepo requires a user id');

  const list = async () => {
    const { data, error } = await supabase
      .from('notes')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(toNoteDTO);
  };

  const create = async (input = {}) => {
    const note = sanitizeNote(input);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('notes')
      .insert({
        id: `n_${crypto.randomUUID()}`,
        user_id: userId,
        title: note.title,
        content: note.content,
        tags: note.tags,
        pinned: note.pinned,
        archived: note.archived,
        created_at: now,
        updated_at: now,
      })
      .select(COLUMNS)
      .single();

    if (error) throw error;
    return toNoteDTO(data);
  };

  /** Returns the updated DTO, or null when the note does not exist. */
  const update = async (id, input = {}) => {
    const { data: existing, error: findError } = await supabase
      .from('notes')
      .select(COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (findError) throw findError;
    if (!existing) return null;

    const next = sanitizeNote(input, toNoteDTO(existing));

    const { data, error } = await supabase
      .from('notes')
      .update({
        title: next.title,
        content: next.content,
        tags: next.tags,
        pinned: next.pinned,
        archived: next.archived,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select(COLUMNS)
      .maybeSingle();

    if (error) throw error;
    return data ? toNoteDTO(data) : null;
  };

  /** Returns true when a row was removed. */
  const remove = async (id) => {
    const { data, error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id');

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  };

  return { list, create, update, remove };
}

module.exports = { createNotesRepo };
