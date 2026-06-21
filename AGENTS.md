## Agent Output Protocol

**Every agent task response MUST end with these fields** (for the orchestrator to parse):

```
TASK: [task ID from prompt, e.g., QUEUE-001]
STATUS: completed | blocked
SUMMARY: [1-3 sentence description of what was accomplished]
FILES_CHANGED: [comma-separated list of modified file paths]
TOKENS_USED: [integer, estimate of tokens consumed]
NOTES: [optional — any blockers, follow-up work, or issues]
```

**Example response format**:
```
I've reviewed the admin page component and refactored the code.

TASK: QUEUE-007
STATUS: completed
SUMMARY: Tested admin page in dev server. All sections load correctly, verified API integration. Added test checklist document.
FILES_CHANGED: src/app/admin/page.js, ADMIN_PAGE_TEST_REPORT.md
TOKENS_USED: 3400
NOTES: Mobile responsiveness could be improved for screens < 480px.
```

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## React Expert Agent

**Purpose**: Provide deep React expertise for component design, state management, hooks optimization, and performance patterns.

**Use cases**:
- Complex component architecture or state management decisions
- React hooks patterns and optimization (useMemo, useCallback, custom hooks)
- Performance profiling and optimization strategies
- Context vs. state libraries (Redux, Zustand, etc.)
- Server vs. client component trade-offs in Next.js App Router
- Testing strategies for React components

**Scope**: React-specific patterns, performance, and architecture. For UI design and component implementation, use the `frontend-design` skill instead.

## Frontend Design Skill

**Purpose**: Build production-grade, distinctive frontend interfaces and components.

**Use cases**:
- Creating new UI components with high design quality
- Building complete pages or features
- Styling and layout implementation
- Component polish and user experience refinement

**Style**: Generates creative, polished code that avoids generic AI aesthetics. Focuses on implementation, not architectural patterns.
