"use client"

import { useSyncExternalStore } from "react"

/** Arc folds table rows into two lines below 620px; tables reorder columns to match. */
const PHONE_QUERY = "(max-width: 620px)"

export function usePhoneLayout() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(PHONE_QUERY)
      query.addEventListener("change", onChange)
      return () => query.removeEventListener("change", onChange)
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  )
}
