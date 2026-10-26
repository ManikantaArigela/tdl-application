/**
 * Per-account settings. Rows are created automatically by the
 * `handle_new_user` trigger when someone signs up, and this repository keeps
 * the mutable fields (currently the IANA timezone used by reminders) in sync.
 */
function createProfilesRepo({ userId, client } = {}) {
  if (!userId) throw new Error('createProfilesRepo requires a user id');
  if (!client) throw new Error('createProfilesRepo requires a Supabase client');

  const table = () => client.from('profiles');

  const get = async () => {
    const { data, error } = await table()
      .select('id, email, timezone, display_name, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  };

  const upsert = async ({ email = null, timezone = null } = {}) => {
    const row = { id: userId, updated_at: new Date().toISOString() };
    if (email) row.email = email;
    if (timezone) row.timezone = timezone;

    const { data, error } = await table()
      .upsert(row, { onConflict: 'id' })
      .select('id, email, timezone, display_name, created_at, updated_at')
      .single();
    if (error) throw error;
    return data;
  };

  return { get, upsert };
}

module.exports = { createProfilesRepo };
