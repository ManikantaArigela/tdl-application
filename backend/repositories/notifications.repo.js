/**
 * Web Push subscriptions. A browser can subscribe once per service-worker
 * registration; the endpoint is the stable identity, so re-subscribing updates
 * the row instead of creating duplicates.
 */
function createNotificationsRepo({ userId, client } = {}) {
  if (!userId) throw new Error('createNotificationsRepo requires a user id');
  if (!client) throw new Error('createNotificationsRepo requires a Supabase client');

  const table = () => client.from('push_subscriptions');

  const list = async () => {
    const { data, error } = await table()
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  };

  const save = async ({ subscription, userAgent = null, timezone = null } = {}) => {
    const endpoint = subscription?.endpoint;
    const keys = subscription?.keys ?? {};

    if (!endpoint || !keys.p256dh || !keys.auth) {
      const error = new Error('A valid push subscription is required.');
      error.status = 400;
      throw error;
    }

    const row = {
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: userAgent,
      timezone,
      last_seen_at: new Date().toISOString(),
    };

    const { data, error } = await table()
      .upsert(row, { onConflict: 'endpoint' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  };

  const removeByEndpoint = async (endpoint) => {
    const { data, error } = await table()
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .select('id');
    if (error) throw error;
    return (data ?? []).length > 0;
  };

  const removeById = async (id) => {
    const { error } = await table().delete().eq('id', id);
    if (error) throw error;
  };

  return { list, save, removeByEndpoint, removeById };
}

module.exports = { createNotificationsRepo };
