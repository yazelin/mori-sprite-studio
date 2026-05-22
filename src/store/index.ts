import { create } from 'zustand'
import type { Project, SpriteState, StateName } from '@/types/project'
import type { ProviderState } from '@/types/provider'
import type { PromptsState } from '@/types/prompts'
import type { ChromaState } from '@/types/chroma'
import {
  DEFAULT_METADATA,
  DEFAULT_LOOP_MODES,
  DEFAULT_LOOP_DURATIONS_MS,
  DEFAULT_STATE_SEMANTICS,
  DEFAULT_TEMPLATES,
  DEFAULT_CHROMA,
  DEFAULT_PROVIDER_STATE,
} from '@/defaults'
import { STATE_NAMES } from '@/types/project'

function emptyState(name: StateName): SpriteState {
  return {
    staticBase: null,
    sheet: null,
    poseNote: '',
    notes: Array(16).fill(''),
    loopMode: DEFAULT_LOOP_MODES[name],
    loopDurationMs: DEFAULT_LOOP_DURATIONS_MS[name],
    status: 'pending',
  }
}

function initialProject(): Project {
  const states = {} as Record<StateName, SpriteState>
  for (const n of STATE_NAMES) states[n] = emptyState(n)
  return {
    characterRef: null,
    states,
    metadata: { ...DEFAULT_METADATA, tags: [...DEFAULT_METADATA.tags] },
  }
}

function initialPrompts(): PromptsState {
  return {
    templates: { ...DEFAULT_TEMPLATES },
    stateSemantics: { ...DEFAULT_STATE_SEMANTICS },
  }
}

export type View = { kind: 'project' } | { kind: 'state'; name: StateName } | { kind: 'export' }

interface UIState {
  view: View
  selectedCell: number | null
}

export interface AppStore {
  project: Project
  prompts: PromptsState
  provider: ProviderState
  chroma: ChromaState
  ui: UIState

  setView: (view: View) => void
  selectCell: (cell: number | null) => void
  setCharacterRef: (blob: Blob | null) => void
  updateMetadata: (patch: Partial<Project['metadata']>) => void
  updateState: (name: StateName, patch: Partial<SpriteState>) => void
  setStateNote: (name: StateName, index: number, note: string) => void
  setStateSemantics: (name: StateName, value: string) => void
  setTemplate: (key: keyof PromptsState['templates'], value: string) => void
  resetTemplate: (key: keyof PromptsState['templates']) => void
  setProviderActive: (name: ProviderState['active']) => void
  updateProviderConfig: <K extends Exclude<keyof ProviderState, 'active'>>(
    name: K,
    patch: Partial<ProviderState[K]>,
  ) => void
  setChroma: (patch: Partial<ChromaState>) => void
}

export const useAppStore = create<AppStore>((set) => ({
  project: initialProject(),
  prompts: initialPrompts(),
  provider: { ...DEFAULT_PROVIDER_STATE },
  chroma: { ...DEFAULT_CHROMA },
  ui: { view: { kind: 'project' }, selectedCell: null },

  setView: (view) => set((s) => ({ ui: { ...s.ui, view, selectedCell: null } })),
  selectCell: (cell) => set((s) => ({ ui: { ...s.ui, selectedCell: cell } })),

  setCharacterRef: (blob) =>
    set((s) => ({ project: { ...s.project, characterRef: blob } })),

  updateMetadata: (patch) =>
    set((s) => ({ project: { ...s.project, metadata: { ...s.project.metadata, ...patch } } })),

  updateState: (name, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        states: { ...s.project.states, [name]: { ...s.project.states[name], ...patch } },
      },
    })),

  setStateNote: (name, index, note) =>
    set((s) => {
      const notes = [...s.project.states[name].notes]
      notes[index] = note
      return {
        project: {
          ...s.project,
          states: { ...s.project.states, [name]: { ...s.project.states[name], notes } },
        },
      }
    }),

  setStateSemantics: (name, value) =>
    set((s) => ({
      prompts: {
        ...s.prompts,
        stateSemantics: { ...s.prompts.stateSemantics, [name]: value },
      },
    })),

  setTemplate: (key, value) =>
    set((s) => ({
      prompts: { ...s.prompts, templates: { ...s.prompts.templates, [key]: value } },
    })),

  resetTemplate: (key) =>
    set((s) => ({
      prompts: { ...s.prompts, templates: { ...s.prompts.templates, [key]: DEFAULT_TEMPLATES[key] } },
    })),

  setProviderActive: (name) =>
    set((s) => ({ provider: { ...s.provider, active: name } })),

  updateProviderConfig: (name, patch) =>
    set((s) => ({
      provider: { ...s.provider, [name]: { ...s.provider[name], ...patch } },
    })) as never,

  setChroma: (patch) => set((s) => ({ chroma: { ...s.chroma, ...patch } })),
}))
