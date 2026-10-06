# frontend-quality Specification

## Purpose

規範前端瀏覽器測試的隔離方式、核心使用者流程、關鍵無障礙要求，以及測試失敗時的診斷輸出。

## Requirements

### Requirement: Deterministic browser test isolation

The frontend test suite SHALL execute each browser test in an isolated browser context. Before the application first runs in that context, the fixture SHALL remove only the `easy-eat-mock-db-v1` localStorage entry so the application creates its default restaurants, categories, and empty order list.

The fixture SHALL preserve data created inside the same test across page reloads. Data created by one test MUST NOT be visible to another test.

#### Scenario: reload preserves current test data

- **WHEN** a browser test creates a draft order and reloads the page
- **THEN** the draft order remains visible with the same identifier, items, and status

#### Scenario: next test starts from defaults

- **WHEN** a browser test starts after a previous test created orders and admin data
- **THEN** the new test starts with the default restaurants and categories
- **AND** the order list is empty
- **AND** the previous test's custom data is absent


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

---
### Requirement: Order lifecycle browser protection

The frontend SHALL provide an end-to-end test that completes the supported order lifecycle through user-visible controls. The test SHALL create a draft order, verify persistence after reload, edit its contents, submit it to `pending`, and update it to `completed`.

Each transition SHALL be verified through the rendered status, order details, and available actions rather than direct Store, Service, API, mock server, or localStorage calls.

#### Scenario: draft reaches completed state

- **WHEN** the browser test creates a draft with one enabled menu item, reloads it, edits the quantity or note, submits it, and marks it completed
- **THEN** the order detail displays the edited values after reload
- **AND** the displayed state changes from `draft` to `pending` and then to `completed`
- **AND** actions forbidden for the current state are not available

##### Example: protected transition sequence

| Step | Expected state | Required observable result |
| ----- | -------------- | -------------------------- |
| Create draft | `draft` | Draft appears in the order list |
| Reload | `draft` | Same order and item values remain |
| Submit | `pending` | Complete and cancel actions become available |
| Complete | `completed` | Edit, submit, complete, and cancel actions are unavailable |


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

---
### Requirement: Admin-to-order browser protection

The frontend SHALL provide an end-to-end test that creates a menu category, restaurant, and menu item through the admin interface, then uses the created restaurant and menu item to create a pending order.

The test SHALL verify each created entity in the rendered admin list before using it in the next step. The test MUST NOT seed the created entities through direct localStorage or mock server calls.

#### Scenario: newly managed data is orderable

- **WHEN** the browser test creates category `E2E 分類`, restaurant `E2E 餐廳`, and menu item `E2E 套餐` with price `180`
- **AND** the browser test opens the new-order route and submits an order containing that menu item
- **THEN** the order is created with status `pending`
- **AND** its detail displays restaurant `E2E 餐廳`, menu item `E2E 套餐`, and unit price `180`


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

---
### Requirement: Automated accessibility gate

The frontend SHALL scan `/`, `/orders/add`, `/statistics`, `/admin`, and `/route-that-does-not-exist` with axe after initial loading completes. Each scanned page SHALL contain zero axe violations whose impact is `critical` or `serious`.

A failing accessibility assertion SHALL report the axe rule identifier, impact, help URL, and affected target nodes. The complete axe result SHALL be attached to the browser test artifacts so `moderate` and `minor` findings remain available without blocking this change. The scan MUST NOT disable axe rules or exclude the application's primary content region.

#### Scenario: primary routes pass the accessibility gate

- **WHEN** the accessibility browser suite scans every required route after its loading state completes
- **THEN** the filtered list of `critical` and `serious` violations is empty for every route

#### Scenario: violation output is actionable

- **WHEN** a required route contains a `critical` or `serious` axe violation
- **THEN** the browser test fails with the rule identifier, impact, help URL, and affected target nodes in its output
- **AND** the complete axe result remains attached to the test artifacts


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

---
### Requirement: Keyboard-operable critical controls

The main navigation, order form controls, admin tabs, and admin CRUD controls SHALL be reachable using Tab and Shift+Tab. Native buttons, links, inputs, and selects SHALL retain their native Enter or Space behavior. Every keyboard-focused interactive element SHALL display a visible focus indicator with at least a two-pixel outline that is not removed by component styles.

The frontend MUST NOT add positive tabindex values or assign button behavior to a non-interactive element when a native button or link can represent the control.

#### Scenario: keyboard user operates a critical flow

- **WHEN** a user navigates the sidebar, opens the new-order route, selects form controls, and activates a submit button using only the keyboard
- **THEN** focus remains visible at each interactive control
- **AND** the native controls perform the same actions as pointer activation

#### Scenario: admin tabs expose state

- **WHEN** a keyboard user activates the restaurant or category admin tab
- **THEN** the selected tab is programmatically identifiable
- **AND** focus remains on the activated tab
- **AND** the associated management panel is rendered


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

---
### Requirement: Executable browser test command

The frontend package SHALL provide `test:e2e` and `test:e2e:ui` scripts. `test:e2e` SHALL start or reuse the Vite application server and execute all browser specifications in headless Chromium. `test:e2e:ui` SHALL start Playwright UI mode for local debugging.

A failed assertion, page error, accessibility gate violation, browser launch failure, or Vite server startup failure SHALL cause `test:e2e` to exit with a non-zero status. Failed tests SHALL retain an HTML report, trace, screenshot, and video.

#### Scenario: complete browser suite succeeds

- **WHEN** a developer runs `npm run test:e2e` from `easy-eat-front`
- **THEN** the Vite server and headless Chromium execute all browser specifications
- **AND** the command exits with status zero only when every specification passes

#### Scenario: failed test retains diagnostics

- **WHEN** any browser specification fails
- **THEN** the command exits with a non-zero status
- **AND** the Playwright report contains a trace, screenshot, and video for the failed test

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