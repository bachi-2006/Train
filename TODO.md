# TODO: Fix Simulator to Conflicts Workflow

## Steps to Complete

1. **Update ConflictChecker.tsx**
   - Change component to use props (conflicts, onRegisterConflict, onRunSimulator, isSimulating) instead of local state
   - Add "Register Conflict" button for each conflict
   - Add "Run Simulator" button that appears after conflicts are registered
   - Remove local conflicts state and use props.conflicts

2. **Test the Complete Flow**
   - Enter train details in Simulator tab
   - Press Enter to create conflict and switch to Conflicts tab
   - Register the conflict
   - Press Run Simulator to start simulation

## Completed Tasks

- [x] Analyzed current ConflictChecker.tsx structure
- [x] Identified that component uses local state instead of props
- [x] Planned workflow: Simulator -> Enter -> Conflicts -> Register -> Run Simulator
- [x] Updated ConflictChecker.tsx to use props instead of local state
- [x] Added "Register Conflict" button for each conflict
- [x] Added "Run Simulator" button that appears after all conflicts are registered
