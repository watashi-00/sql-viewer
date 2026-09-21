# Contributing

Thanks for helping improve SQL Lab.

## Development setup

Requirements:

- Node.js 20 or newer
- npm 9 or newer

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

## Before opening a pull request

Run the same checks used by CI:

```bash
npm test
npm run build
```

Keep changes focused, add tests for behavior changes, and update the README when
user-facing capabilities or development workflows change.

## Pull requests

- Use a focused branch based on `master`.
- Explain the user-visible behavior and implementation scope.
- Include screenshots or a short recording for visual changes.
- Keep unrelated refactors out of feature pull requests.
- Address CI failures before requesting review.

The `master` branch requires the `test` status check to pass before changes can
be merged.

## Product direction

SQL Lab is focused on helping people understand how SQL transforms data. New
features should reinforce the connection between SQL text, relational stages,
intermediate rows, predicates, aggregates, and physical execution plans.