import type { JSX } from "react";

import { cx } from "../cx.js";

import { Icon } from "./Icon.js";

export interface StepperStep {
  label: string;
  description?: string;
}

export interface StepperProps {
  /** Names the sequence for assistive tech ("Etapes de la demande"). */
  label: string;
  steps: StepperStep[];
  /** Index of the step in progress; steps before it are complete. */
  current: number;
  orientation?: "horizontal" | "vertical";
  /** Spoken after a completed step's name. */
  completedLabel?: string;
  testId?: string;
}

/**
 * Part 2B "Stepper / Wizard": an ordered list, the current step marked
 * `aria-current="step"`, completion said in words and shown with a check —
 * not by colour alone. Navigation between steps belongs to the form using it.
 */
export function Stepper({ label, steps, current, orientation = "horizontal", completedLabel = "terminee", testId }: StepperProps): JSX.Element {
  return (
    <ol className={cx("fx-stepper", `fx-stepper--${orientation}`)} aria-label={label} data-testid={testId}>
      {steps.map((step, index) => {
        const state = index < current ? "complete" : index === current ? "current" : "upcoming";
        return (
          <li key={step.label} className={cx("fx-stepper__step", `fx-stepper__step--${state}`)} aria-current={state === "current" ? "step" : undefined}>
            <span className="fx-stepper__indicator" aria-hidden="true">
              {state === "complete" ? <Icon name="check" size="sm" /> : (index + 1).toString()}
            </span>
            <span className="fx-stepper__text">
              <span className="fx-stepper__label">
                {step.label}
                {state === "complete" ? <span className="fx-visually-hidden"> ({completedLabel})</span> : null}
              </span>
              {step.description ? <span className="fx-stepper__description">{step.description}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
