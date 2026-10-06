# async-feedback Specification

## Purpose

規範前端非同步操作的 loading 狀態與 toast 成功／錯誤回饋，並定義可重用載入指示器的呈現契約。

## Requirements

### Requirement: Async action composable

The system SHALL provide a `useAsyncAction` composable that encapsulates loading state management and toast-based success/error feedback for asynchronous operations.

The composable SHALL expose:
- `loading`: a read-only ref that is `true` while an async action is executing, `false` otherwise
- `run(action, options)`: executes an async action with automatic loading and toast handling

The `run` function SHALL:
1. Set `loading` to `true` before executing the action
2. Execute the provided `action` function
3. On success: call `toast.success(successMessage)` if `options.successMessage` is provided, return the action's result
4. On failure: call `toast.error(getErrorMessage(error, options.errorMessage))` and return `undefined`
5. Set `loading` to `false` in all cases (success or failure)

The `run` function SHALL NOT re-throw errors caught from the action.

#### Scenario: successful action with success message

- **WHEN** `run(action, { successMessage: '已儲存' })` is called and `action()` resolves to a value
- **THEN** `loading` is `true` during execution and `false` after
- **AND** `toast.success` is called with `'已儲存'`
- **AND** `run` returns the resolved value

#### Scenario: successful action without success message

- **WHEN** `run(action)` is called (no `options`) and `action()` resolves to a value
- **THEN** `toast.success` is NOT called
- **AND** `run` returns the resolved value

#### Scenario: failed action with error message

- **WHEN** `run(action, { errorMessage: '操作失敗' })` is called and `action()` rejects with an error
- **THEN** `toast.error` is called with the error message derived from `getErrorMessage(error, '操作失敗')`
- **AND** `run` returns `undefined`
- **AND** the error is NOT re-thrown

#### Scenario: failed action without error message

- **WHEN** `run(action)` is called (no `options`) and `action()` rejects with an error
- **THEN** `toast.error` is called with the error message derived from `getErrorMessage(error)`
- **AND** `run` returns `undefined`

##### Example: loading lifecycle

| Phase | loading value |
| ----- | ------------- |
| Before `run` call | false |
| During `action()` execution | true |
| After `action()` resolves | false |
| After `action()` rejects | false |


<!-- @trace
source: strengthen-frontend
updated: 2026-08-28
code:
  - easy-eat-front/src/components/LoadingSpinner.vue
  - easy-eat-front/src/composables/useAsyncAction.ts
  - .agents/skills/spectra-drift/SKILL.md
  - .github/skills/spectra-ingest/SKILL.md
  - .spectra.yaml
  - .agents/skills/spectra-archive/SKILL.md
  - easy-eat-front/src/views/OrderAddView.vue
  - .github/prompts/spectra-drift.prompt.md
  - AGENTS.md
  - .github/prompts/spectra-ask.prompt.md
  - .agents/skills/spectra-audit/SKILL.md
  - .github/skills/spectra-propose/SKILL.md
  - .github/prompts/spectra-apply.prompt.md
  - .agents/skills/spectra-debug/SKILL.md
  - .github/skills/spectra-apply/SKILL.md
  - .github/skills/spectra-drift/SKILL.md
  - .github/skills/spectra-commit/SKILL.md
  - .agents/skills/spectra-ask/SKILL.md
  - .agents/skills/spectra-propose/SKILL.md
  - .github/prompts/spectra-debug.prompt.md
  - .github/prompts/spectra-propose.prompt.md
  - .github/skills/spectra-debug/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .github/prompts/spectra-commit.prompt.md
  - .github/prompts/spectra-discuss.prompt.md
  - .github/skills/spectra-audit/SKILL.md
  - easy-eat-front/src/views/OrderDetailView.vue
  - easy-eat-front/src/views/OrderEditView.vue
  - .agents/skills/spectra-apply/SKILL.md
  - .github/skills/spectra-discuss/SKILL.md
  - .github/prompts/spectra-audit.prompt.md
  - .github/prompts/spectra-archive.prompt.md
  - .github/prompts/spectra-ingest.prompt.md
  - .agents/skills/spectra-discuss/SKILL.md
  - .github/skills/spectra-archive/SKILL.md
  - .github/skills/spectra-ask/SKILL.md
  - easy-eat-front/src/views/OrderListView.vue
tests:
  - easy-eat-front/src/services/restaurantService.test.ts
  - easy-eat-front/src/api/restaurantApi.test.ts
  - easy-eat-front/src/composables/useAsyncAction.test.ts
  - easy-eat-front/src/api/orderApi.test.ts
  - easy-eat-front/src/services/orderService.test.ts
  - easy-eat-front/src/components/LoadingSpinner.test.ts
-->

---
### Requirement: Loading spinner component

The system SHALL provide a `LoadingSpinner` Vue component that displays a CSS-animated rotating indicator for loading states.

The component SHALL accept:
- `size`: `'sm' | 'md' | 'lg'`, defaulting to `'md'`
- `label`: a string used as the accessible loading status name, defaulting to `載入中`

The component SHALL render an element with class `loading-spinner`, a size modifier class (`loading-spinner--sm`, `loading-spinner--md`, or `loading-spinner--lg`), `role="status"`, and an `aria-label` equal to `label`.

A page that uses `LoadingSpinner` SHALL provide a context-specific label when the default `載入中` does not identify the loading operation. The page's primary content container SHALL expose `aria-busy="true"` while loading and SHALL set it to `false` or remove it after loading completes. The page MUST NOT create a second status region that announces the same loading message.

The component SHALL NOT require any runtime dependency beyond Vue.

#### Scenario: default size and label

- **WHEN** `<LoadingSpinner />` is rendered without props
- **THEN** the rendered element has class `loading-spinner loading-spinner--md`
- **AND** it has `role="status"` and `aria-label="載入中"`

#### Scenario: custom size and contextual label

- **WHEN** `<LoadingSpinner size="lg" label="統計資料載入中" />` is rendered
- **THEN** the rendered element has class `loading-spinner loading-spinner--lg`
- **AND** it has `role="status"` and `aria-label="統計資料載入中"`

#### Scenario: page exposes one loading announcement

- **WHEN** a page is loading and renders `LoadingSpinner` with a context-specific label
- **THEN** the page's primary content container has `aria-busy="true"`
- **AND** exactly one status region announces that loading label

#### Scenario: page clears busy state

- **WHEN** the page finishes loading successfully or with an error
- **THEN** the primary content container has `aria-busy="false"` or no `aria-busy` attribute

<!-- @trace
source: harden-frontend-quality
updated: 2026-09-17
code:
  - .github/skills/spectra-audit/SKILL.md
  - .agents/skills/spectra-audit/SKILL.md
  - .github/prompts/spectra-ingest.prompt.md
  - .github/prompts/spectra-propose.prompt.md
  - .github/skills/spectra-drift/SKILL.md
  - .github/skills/spectra-apply/SKILL.md
  - .agents/skills/spectra-propose/SKILL.md
  - .github/prompts/spectra-commit.prompt.md
  - easy-eat-front/src/views/OrderAddView.vue
  - easy-eat-front/src/views/OrderListView.vue
  - .github/skills/spectra-propose/SKILL.md
  - .agents/skills/spectra-archive/SKILL.md
  - easy-eat-front/src/components/LoadingSpinner.vue
  - .github/prompts/spectra-archive.prompt.md
  - .agents/skills/spectra-drift/SKILL.md
  - .github/prompts/spectra-audit.prompt.md
  - .github/prompts/spectra-apply.prompt.md
  - .agents/skills/spectra-debug/SKILL.md
  - .github/prompts/spectra-ask.prompt.md
  - easy-eat-front/src/views/OrderDetailView.vue
  - easy-eat-front/src/views/OrderEditView.vue
  - .github/skills/spectra-ask/SKILL.md
  - .agents/skills/spectra-discuss/SKILL.md
  - .agents/skills/spectra-ask/SKILL.md
  - .github/prompts/spectra-discuss.prompt.md
  - .github/skills/spectra-debug/SKILL.md
  - .github/skills/spectra-archive/SKILL.md
  - easy-eat-front/src/composables/useAsyncAction.ts
  - AGENTS.md
  - .agents/skills/spectra-apply/SKILL.md
  - .agents/skills/spectra-ingest/SKILL.md
  - .github/prompts/spectra-drift.prompt.md
  - .github/skills/spectra-commit/SKILL.md
  - .agents/skills/spectra-commit/SKILL.md
  - .spectra.yaml
  - .github/skills/spectra-discuss/SKILL.md
  - .github/skills/spectra-ingest/SKILL.md
  - .github/prompts/spectra-debug.prompt.md
tests:
  - easy-eat-front/src/api/orderApi.test.ts
  - easy-eat-front/src/composables/useAsyncAction.test.ts
  - easy-eat-front/src/api/restaurantApi.test.ts
  - easy-eat-front/src/services/orderService.test.ts
  - easy-eat-front/src/services/restaurantService.test.ts
  - easy-eat-front/src/components/LoadingSpinner.test.ts
-->