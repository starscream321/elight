# Orchestrate multi-agent workflow

Run the full multi-agent development workflow for the user's request.

## Goal
Use the planner, frontend, backend, and reviewer sub-agents together.

## Workflow
1. Read the user request carefully.
2. Invoke the planner sub-agent first.
3. The planner must:
   - analyze the request
   - split it into small concrete subtasks
   - assign each task to frontend or backend
   - define dependencies
   - define acceptance criteria
   - initialize a task board

4. After planning:
   - dispatch frontend tasks to the frontend sub-agent
   - dispatch backend tasks to the backend sub-agent
   - allow parallel execution only for tasks without blocked dependencies

5. Every completed task must be sent to the reviewer sub-agent.
6. If reviewer returns `changes_requested`, send the task back only to the original owner.
7. Repeat implementation -> review -> rework until reviewer returns `approved`.
8. Continue until all tasks are `done`.
9. When all tasks are complete:
   - clear the active task list
   - return a final summary

## Required task schema
Each task must contain:
- id
- title
- owner
- dependencies
- acceptanceCriteria
- status
- reviewNotes

Allowed statuses:
- todo
- in_progress
- in_review
- changes_requested
- done

## Critical rules
- Never skip review
- Never mark a task done before reviewer approval
- Never assign frontend work to backend
- Never assign backend work to frontend
- Do not start blocked tasks
- Independent tasks may run in parallel
- Preserve task state and review feedback until the workflow is fully complete

## Required output structure
### Plan
- short goal summary
- subtasks with owners, dependencies, and acceptance criteria

### Task Board
For each task show:
- id
- title
- owner
- status
- dependencies
- reviewNotes

### Execution
Show:
- which sub-agent is working on which task
- review decisions
- rework loops if any

### Final Summary
- completed frontend tasks
- completed backend tasks
- reviewer outcomes
- final status
- confirmation that task list was cleared

## User request
{{$ARGUMENTS}}