# Habit Tracker App PRD

## Goal

Build a small habit tracker application for solo users who want to plan daily habits, mark completions, and review weekly streaks.

## Product Requirements

- Users can create, edit, archive, and reorder habits.
- Users can mark a habit complete for a calendar day.
- The dashboard shows today's habits, completion state, and current streak.
- The weekly view shows seven days of completion history.
- The data model must support local persistence first and later server sync.
- The app should include unit tests for streak calculation and integration tests for the completion flow.

## Technical Preferences

- Use a React UI with accessible form controls.
- Keep persistence behind a repository interface.
- Keep API route contracts explicit, even if the first implementation is local-only.
- Avoid source-of-truth edits unless a workflow explicitly asks for them.

## Validation Expectations

- Validate schema boundaries for habit records and completion records.
- Validate keyboard-accessible create/edit flows.
- Validate streak calculations against missed days and archive boundaries.
- Produce a runnable implementation plan with test commands and release checks.
