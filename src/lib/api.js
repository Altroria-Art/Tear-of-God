import { supabase } from './supabaseClient'

const RANKINGS = 'rankings'
const RANKING_ITEMS = 'ranking_items'

const wrap = async (fn) => {
  try {
    const { data, error } = await fn()
    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error(err)
    return { data: null, error: err.message || err }
  }
}

export const fetchRankings = (category = null, page = 0, pageSize = 20) =>
  wrap(() => {
    let query = supabase
      .from(RANKINGS)
      .select('*, profile:profiles(*), ranking_items:ranking_items(*, item:items(*))')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (category) query = query.eq('category', category)
    return query
  })

export const fetchRanking = (id) =>
  wrap(() =>
    supabase
      .from(RANKINGS)
      .select('*, profile:profiles(*), ranking_items:ranking_items(*, item:items(*))')
      .eq('id', id)
      .single()
  )

export const createRanking = (payload, items = []) =>
  wrap(async () => {
    const { data: ranking, error } = await supabase
      .from(RANKINGS)
      .insert(payload)
      .select()
      .single()
    if (error || !items.length) return { data: ranking, error }

    const { error: itemError } = await supabase.from(RANKING_ITEMS).insert(
      items.map((item) => ({ ...item, ranking_id: ranking.id }))
    )
    return { data: ranking, error: itemError }
  })

export const updateRanking = (id, patch) =>
  wrap(() => supabase.from(RANKINGS).update(patch).eq('id', id).select().single())

export const deleteRanking = (id) =>
  wrap(async () => {
    const { error } = await supabase.from(RANKING_ITEMS).delete().eq('ranking_id', id)
    if (error) return { data: null, error }
    return supabase.from(RANKINGS).delete().eq('id', id)
  })

export const toggleLike = async (rankingId) => {
  const user = await supabase.auth.getUser()
  if (user.error) return { data: null, error: 'Please sign in to like.' }

  const existing = await wrap(() =>
    supabase.from('likes').select('id').eq('ranking_id', rankingId).eq('user_id', user.data.user.id).maybeSingle()
  )
  if (existing.error) return existing

  return existing.data
    ? wrap(() => supabase.from('likes').delete().eq('id', existing.data.id))
    : wrap(() => supabase.from('likes').insert({ ranking_id: rankingId, user_id: user.data.user.id }))
}
