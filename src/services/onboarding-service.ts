import type { OnboardingChecklistState, OnboardingStep } from '@/types/engine';

export const ONBOARDING_STEPS: Array<{ id: OnboardingStep; label: string; description: string }> = [
  { id: 'mode', label: 'Choose a mode', description: 'Start with Strict NES or Modern mode.' },
  { id: 'audio', label: 'Verify audio', description: 'Start the workstation and confirm audio is ready.' },
  { id: 'midi', label: 'Connect MIDI', description: 'Connect a keyboard or controller if available.' },
  { id: 'test-song', label: 'Load a demo', description: 'Open a bundled test song or starter project.' },
  { id: 'controller-map', label: 'Map one control', description: 'Use MIDI Learn on one knob, button, or slider.' },
  { id: 'first-loop', label: 'Create first loop', description: 'Add markers and set a loop region.' },
];

export function completeOnboardingStep(
  checklist: OnboardingChecklistState,
  step: OnboardingStep
): OnboardingChecklistState {
  if (checklist.completedSteps.includes(step)) return checklist;
  return {
    ...checklist,
    completedSteps: [...checklist.completedSteps, step],
  };
}

export function isOnboardingComplete(checklist: OnboardingChecklistState): boolean {
  return ONBOARDING_STEPS.every((step) => checklist.completedSteps.includes(step.id));
}
