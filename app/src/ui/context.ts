import { createContext, useContext } from 'react';
import type { AnalysisResult } from '../analysis/analyzeProject';
import { useStore } from '../state/store';
import type { UnitContext } from '../core/units';

export const AnalysisContext = createContext<AnalysisResult | null>(null);

export function useAnalysis(): AnalysisResult {
  const a = useContext(AnalysisContext);
  if (!a) throw new Error('AnalysisContext missing');
  return a;
}

export function useUnits(): UnitContext {
  return useStore((s) => s.project.settings);
}
