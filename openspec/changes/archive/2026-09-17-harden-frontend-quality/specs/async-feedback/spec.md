## MODIFIED Requirements

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
