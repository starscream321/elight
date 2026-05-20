---
name: multi-agent-dev-workflow
description: Orchestrates a multi-agent software development workflow using planner, frontend, backend, and reviewer agents. Use when the user provides a high-level software task that requires decomposition, implementation, and review before completion.
---

# Multi-Agent Software Development Workflow

Orchestrates planner, frontend, backend, and reviewer agents to complete software tasks with mandatory review.

## Purpose

Receive high-level software tasks, decompose them into implementation-sized subtasks, implement via frontend/backend specialists, and enforce review before completion. No task is marked done without reviewer approval.

## Participating Agents

| Agent | Role |
|-------|------|
| planner | Decomposes high-level task into subtasks; assigns owner; defines dependencies and acceptance criteria |
| frontend | Vue, UI, client-side, API integration |
| backend | NestJS, controllers, services, DTOs, DB, business logic, API |
| reviewer | Approves or requests changes; returns `approved` or `changes_requested` |

## Task Schema

Every subtask must have:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | yes | Unique identifier |
| title | string | yes | Short description |
| owner | `"frontend"` \| `"backend"` | yes | Implementing agent |
| dependencies | string[] | yes | IDs of tasks that must be `done` before this task starts |
| acceptanceCriteria | string[] | yes | Conditions that must be met |
| status | enum | yes | See statuses below |
| reviewNotes | string | no | Feedback from reviewer (when `changes_requested`) |

### Statuses

- `todo` — Not started
- `in_progress` — Being implemented
- `in_review` — With reviewer
- `changes_requested` — Reviewer requested changes; returned to owner
- `done` — Approved by reviewer

## Assignment Rules

- **Frontend**: Vue, UI components, client-side logic, API integration, styles, routing
- **Backend**: NestJS controllers, services, DTOs, entities, database, business logic, REST/API design

**CRITICAL**:
- Never assign frontend work to backend
- Never assign backend work to frontend
- Each task has exactly one owner (`frontend` or `backend`)

## Dependency Rules

- Do not start a task until all its dependencies have status `done`
- Independent tasks (empty `dependencies`) may run in parallel
- When multiple tasks are unblocked, prefer parallel execution

## Reviewer Rules

- Every completed task must go to the reviewer
- Never skip review
- Reviewer returns: `approved` or `changes_requested`
- If `changes_requested`, include `reviewNotes` with specific feedback

## Rework Loop Rules

- If reviewer returns `changes_requested`, return the task to its original owner
- Owner addresses feedback, then resubmit for review
- Repeat until reviewer returns `approved`
- Only when `approved` may status become `done`

## Completion Rules

- Never mark a task `done` before reviewer approval
- Clear the task list only after all subtasks have status `done`
- Then finish and summarize

## Workflow Stages

1. **Receive** — High-level task from user
2. **Plan** — planner decomposes into subtasks; assigns owner; sets dependencies
3. **Implement** — frontend/backend work on unblocked tasks
4. **Review** — reviewer evaluates each completed implementation
5. **Rework** — if `changes_requested`, owner fixes and resubmits
6. **Complete** — all tasks `done` → clear list → finish

## Output Structure

When invoking agents, pass:
- Current task or task list
- Relevant context (codebase, prior tasks, review feedback)
- Expected output format (e.g. updated task with status and reviewNotes)

## Orchestration Algorithm (Pseudocode)

```
tasks = planner.decompose(high_level_task)
assert each task has: id, title, owner, dependencies, acceptanceCriteria, status="todo"

while any task.status != "done":
  unblocked = [t for t in tasks if t.status == "todo" and all(dep in done_ids for dep in t.dependencies)]
  
  for task in unblocked:
    if task.status == "todo":
      task.status = "in_progress"
      result = invoke(task.owner, task)
      task = merge(result, task)
      task.status = "in_review"
  
  in_review = [t for t in tasks if t.status == "in_review"]
  for task in in_review:
    verdict = reviewer.review(task)
    if verdict == "approved":
      task.status = "done"
      task.reviewNotes = ""
    else:
      task.status = "changes_requested"
      task.reviewNotes = verdict.feedback
  
  changes_requested = [t for t in tasks if t.status == "changes_requested"]
  for task in changes_requested:
    task.status = "in_progress"
    result = invoke(task.owner, task, reviewNotes=task.reviewNotes)
    task = merge(result, task)
    task.status = "in_review"

clear(task_list)
finish()
```

## JSON Task Example

```json
{
  "id": "fe-001",
  "title": "Add user login form to LoginView",
  "owner": "frontend",
  "dependencies": ["be-001"],
  "acceptanceCriteria": [
    "Email and password inputs with validation",
    "Submit calls POST /auth/login",
    "Store token and redirect on success"
  ],
  "status": "todo",
  "reviewNotes": ""
}
```

## Markdown Task Board Example

```markdown
# Task Board

| ID | Title | Owner | Status | Dependencies |
|----|-------|-------|--------|--------------|
| be-001 | Create POST /auth/login endpoint | backend | done | [] |
| fe-001 | Add user login form to LoginView | frontend | in_review | [be-001] |
| be-002 | Add JWT validation middleware | backend | todo | [be-002] |
| fe-002 | Implement protected route guard | frontend | todo | [be-002] |

**In progress:** —
**Blocked:** be-002 (waiting on be-001), fe-002 (waiting on be-002)
```

## Critical Rules Summary

- Never skip review
- Never mark `done` before reviewer approval
- Never assign frontend work to backend or backend work to frontend
- Do not start tasks with unresolved dependencies
- Allow parallel execution for independent tasks
- Preserve task state and review feedback throughout
- Clear the task list only after all tasks are `done`
