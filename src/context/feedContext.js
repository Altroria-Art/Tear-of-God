import { createContext, useContext } from 'react'

export const FeedContext = createContext(null)

export function useFeed() {
  const ctx = useContext(FeedContext)
  if (!ctx) throw new Error('useFeed must be used within a FeedProvider')
  return ctx
}
