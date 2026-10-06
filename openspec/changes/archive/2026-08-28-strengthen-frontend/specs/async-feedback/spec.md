## ADDED Requirements

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

### Requirement: Loading spinner component

The system SHALL provide a `LoadingSpinner` Vue component that displays a CSS-animated rotating indicator for loading states.

The component SHALL accept:
- `size`: `'sm' | 'md' | 'lg'`, defaulting to `'md'`

The component SHALL render an element with class `loading-spinner` and a size modifier class (`loading-spinner--sm`, `loading-spinner--md`, or `loading-spinner--lg`).

The component SHALL NOT require any external dependencies beyond Vue.

#### Scenario: default size

- **WHEN** `<LoadingSpinner />` is rendered without a `size` prop
- **THEN** the rendered element has class `loading-spinner loading-spinner--md`

#### Scenario: small size

- **WHEN** `<LoadingSpinner size="sm" />` is rendered
- **THEN** the rendered element has class `loading-spinner loading-spinner--sm`

#### Scenario: large size

- **WHEN** `<LoadingSpinner size="lg" />` is rendered
- **THEN** the rendered element has class `loading-spinner loading-spinner--lg`
