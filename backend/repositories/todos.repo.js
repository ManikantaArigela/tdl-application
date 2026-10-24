const crypto = require('crypto');

const { sanitizeTodo } = require('../lib/sanitize');
const { toTodoDTO } = require('../lib/dto');

const COLUMNS =
  'id,text,priority,completed,due_date,due_time,repeat,completed_at,created_at,sort_order';

const iso = (ms) => (typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null);

/**
 * Todos repository bound to one signed-in user. Same contract as the previous
 * storage layer: list/create/update/remove/reorder.
 */
function createTodosRepo({ supabase, userId } = {}) {
  if (!supabase) throw new Error('createTodosRepo requires a Supabase client');
  if (!userId) throw new Error('createTodosRepo requires a user id');

  const list = async () => {
    const { data, error } = await supabase
      .from('todos')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(toTodoDTO);
  };

  /**
   * New todos sort to the top without shifting every row: take the lowest
   * current order and step one below it.
   */
  const nextTopOrder = async () => {
    const { data, error } = await supabase
      .from('todos')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .limit(1);

    if (error) throw error;
    return data?.[0] ? Number(data[0].sort_order) - 1 : 0;
  };

  const create = async (input = {}) => {
    const todo = sanitizeTodo(input);
    if (!todo.text) return { ok: false, reason: 'invalid' };

    const { data, error } = await supabase
      .from('todos')
      .insert({
        id: `t_${crypto.randomUUID()}`,
        user_id: userId,
        text: todo.text,
        priority: todo.priority,
        completed: todo.completed,
        due_date: todo.dueDate,
        due_time: todo.dueTime,
        repeat: todo.repeat,
        completed_at: iso(todo.completedAt),
        created_at: new Date().toISOString(),
        sort_order: await nextTopOrder(),
      })
      .select(COLUMNS)
      .single();

    if (error) throw error;
    return { ok: true, todo: toTodoDTO(data) };
  };

  const update = async (id, input = {}) => {
    const { data: existing, error: findError } = await supabase
      .from('todos')
      .select(COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (findError) throw findError;
    if (!existing) return { ok: false, reason: 'not_found' };

    const next = sanitizeTodo(input, toTodoDTO(existing));
    if (!next.text) return { ok: false, reason: 'invalid' };

    const { data, error } = await supabase
      .from('todos')
      .update({
        text: next.text,
        priority: next.priority,
        completed: next.completed,
        due_date: next.dueDate,
        due_time: next.dueTime,
        repeat: next.repeat,
        completed_at: iso(next.completedAt),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select(COLUMNS)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: false, reason: 'not_found' };
    return { ok: true, todo: toTodoDTO(data) };
  };

  const remove = async (id) => {
    const { data, error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id');

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  };

  /**
   * Mirrors the previous contract: ids the client sent (deduped, existing only)
   * come first, then every record it did not send, in current order. Records are
   * never dropped. The canonical list is re-read afterwards so a racing client
   * converges instead of assuming.
   */
  const reorder = async (items) => {
    const existing = await list();
    const byId = new Map(existing.map((todo) => [todo.id, todo]));
    const seen = new Set();
    const orderedIds = [];

    for (const item of items) {
      const id = typeof item === 'string' ? item : item?.id;
      if (!id || seen.has(id) || !byId.has(id)) continue;
      seen.add(id);
      orderedIds.push(id);
    }

    for (const todo of existing) {
      if (!seen.has(todo.id)) orderedIds.push(todo.id);
    }

    if (orderedIds.length > 0) {
      const rows = orderedIds.map((id, index) => {
        const todo = byId.get(id);
        return {
          id,
          user_id: userId,
          text: todo.text,
          priority: todo.priority,
          completed: todo.completed,
          due_date: todo.dueDate,
          due_time: todo.dueTime,
          repeat: todo.repeat,
          completed_at: iso(todo.completedAt),
          created_at: iso(todo.createdAt) ?? new Date().toISOString(),
          sort_order: index,
        };
      });

      const { error } = await supabase.from('todos').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }

    return list();
  };

  return { list, create, update, remove, reorder };
}

module.exports = { createTodosRepo };
