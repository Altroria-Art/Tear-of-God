import { useCallback, useEffect, useState } from 'react'
import { createRanking, deleteRanking, fetchRankings } from '../lib/api'

export default function useRankings(category = null) {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchRankings(category)
    if (error) setError(error)
    else setRankings(data)
    setLoading(false)
  }, [category])

  useEffect(() => {
    load()
  }, [load])

  const add = async (payload, items) => {
    const { data, error } = await createRanking(payload, items)
    if (error) setError(error)
    else setRankings((prev) => [data, ...prev])
  }

  const remove = async (id) => {
    const { error } = await deleteRanking(id)
    if (error) setError(error)
    else setRankings((prev) => prev.filter((r) => r.id !== id))
  }

  return { rankings, loading, error, reload: load, add, remove }
}
