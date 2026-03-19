'use client'
import { create } from 'zustand'
import type { LeadFilters } from '@/types/app.types'

interface LeadColumnPref {
  key: string
  visible: boolean
  order: number
}

interface LeadState {
  filters: LeadFilters
  setFilters: (filters: Partial<LeadFilters>) => void
  clearFilters: () => void
  columnPrefs: LeadColumnPref[]
  setColumnPrefs: (prefs: LeadColumnPref[]) => void
  selectedLeadIds: string[]
  toggleLeadSelection: (id: string) => void
  clearSelection: () => void
}

export const useLeadStore = create<LeadState>((set) => ({
  filters: {},
  setFilters: (newFilters) => set((state) => ({ filters: { ...state.filters, ...newFilters } })),
  clearFilters: () => set({ filters: {} }),
  columnPrefs: [],
  setColumnPrefs: (prefs) => set({ columnPrefs: prefs }),
  selectedLeadIds: [],
  toggleLeadSelection: (id) =>
    set((state) => ({
      selectedLeadIds: state.selectedLeadIds.includes(id)
        ? state.selectedLeadIds.filter((x) => x !== id)
        : [...state.selectedLeadIds, id],
    })),
  clearSelection: () => set({ selectedLeadIds: [] }),
}))
