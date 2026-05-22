import type { StateName } from './project'

export type TemplateKey = 'B1' | 'B2' | 'C' | 'D' | 'W' | 'Dr'

export interface PromptsState {
  templates: Record<TemplateKey, string>
  stateSemantics: Record<StateName, string>
}
