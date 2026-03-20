'use client';

import { ONBOARDING_STEPS, isOnboardingComplete } from '@/services/onboarding-service';
import { useDAWStore } from '@/store/daw-store';
import type { StarterTemplate } from '@/types/engine';

interface OnboardingChecklistProps {
  onLoadStarter: (templateId: Exclude<StarterTemplate, 'test-song'>) => void;
  onOpenTestSongs: () => void;
  onOpenSettings: () => void;
}

export function OnboardingChecklist({
  onLoadStarter,
  onOpenTestSongs,
  onOpenSettings,
}: OnboardingChecklistProps) {
  const settings = useDAWStore((state) => state.settings);
  const updateUISettings = useDAWStore((state) => state.updateUISettings);
  const resetOnboardingChecklist = useDAWStore((state) => state.resetOnboardingChecklist);

  const checklist = settings.uiConfig.onboardingChecklist;
  const completed = new Set(checklist.completedSteps);
  const done = isOnboardingComplete(checklist);

  if (!settings.uiConfig.showOnboardingChecklist || checklist.dismissed) {
    return (
      <div className="workflow-restore">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            updateUISettings({
              showOnboardingChecklist: true,
              onboardingChecklist: {
                ...checklist,
                dismissed: false,
              },
            })
          }
        >
          Restore Start Here
        </button>
      </div>
    );
  }

  return (
    <aside className="workflow-card" aria-label="Start here checklist">
      <div className="workflow-card-header">
        <div>
          <h2>Start Here</h2>
          <p className="muted">
            {done
              ? 'Studio setup is complete. Reset the checklist any time.'
              : 'Fast path to a usable NES composition workflow.'}
          </p>
        </div>
        <div className="midi-learn-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              updateUISettings({
                onboardingChecklist: {
                  ...checklist,
                  dismissed: true,
                },
              })
            }
          >
            Dismiss
          </button>
          <button type="button" className="btn btn-ghost" onClick={resetOnboardingChecklist}>
            Reset
          </button>
        </div>
      </div>

      <div className="workflow-quick-actions">
        <button type="button" className="btn" onClick={() => onLoadStarter('strict-nes')}>
          Strict NES Starter
        </button>
        <button type="button" className="btn" onClick={() => onLoadStarter('modern')}>
          Modern Starter
        </button>
        <button type="button" className="btn" onClick={onOpenTestSongs}>
          Load Test Song
        </button>
        <button type="button" className="btn btn-ghost" onClick={onOpenSettings}>
          Open Settings
        </button>
      </div>

      <div className="workflow-steps">
        {ONBOARDING_STEPS.map((step) => {
          const complete = completed.has(step.id);
          return (
            <div key={step.id} className={`workflow-step ${complete ? 'is-complete' : ''}`}>
              <span className="workflow-step-badge">{complete ? 'Done' : 'Next'}</span>
              <div>
                <strong>{step.label}</strong>
                <p className="muted">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
