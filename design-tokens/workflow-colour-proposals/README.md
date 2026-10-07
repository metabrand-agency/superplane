/opt/homebrew/Library/Homebrew/cmd/shellenv.sh: line 18: /bin/ps: Operation not permitted
# Superplane workflow colour token proposals

This repository translates the five approved Figma palette explorations into token proposals compatible with the existing Superplane Storybook conventions.

## Review links

- [Figma palette exploration](https://www.figma.com/design/woctuEhFjW0tm6rvpId9Lf/Superplane?node-id=844-29142)
- [Existing Storybook tokens](https://design.superplane.com/?path=/story/factories-design-system-tokens--light)
- [Interactive local preview](./preview.html)

## Proposed semantic mapping

| Workflow stage | Existing status namespace |
| --- | --- |
| Backlog | `draft` |
| Implement | `running` |
| Verify | `waiting` |
| Done | `completed` |

This mapping is intentionally proposed rather than assumed. If workflow stages and execution statuses are different product concepts, keep the colour values but expose them under a dedicated `--workflow-*` namespace.

## Palette options

| Option | Source label | Backlog | Implement | Verify | Done |
| --- | --- | --- | --- | --- | --- |
| 1 | Corporate Flow | `#98A2AD / #7F8986` | `#14767A / #4F9B98` | `#C99A16 / #C6B34B` | `#3C946E / #78A994` |
| 2 | Quiet Brand | `#969EA8 / #89857A` | `#567C96 / #5D8F8B` | `#B88959 / #B4A067` | `#668F7A / #7FA493` |
| 3 | Technical Signals | `#98A2B0 / #AEB8C5` | `#5E8FD3 / #78A7E3` | `#D0A640 / #DEBA5B` | `#5AA37A / #76BA91` |
| 4 | Technical Signals | `#A7B0BC / #B3BDC8` | `#88BBDD / #78ADCF` | `#E8B27F / #D69C6E` | `#8AC9B0 / #79B9A1` |
| 5 | Technical Signals | `#8F99A6 / #A9B4C1` | `#3F87D1 / #6AAAE6` | `#7A5AC5 / #9A7DDD` | `#1798A8 / #49BAC7` |

Values are shown as `Light / Dark`.

## Files

- `tokens/proposals.json` — source values, Figma mix percentages, mapping, and review metadata.
- `tokens/proposals.css` — copy-ready CSS custom-property overrides.
- `preview.html` — zero-build visual comparison of all options in Light and Dark themes.

## Integration model

The CSS intentionally does not replace the existing neutral surfaces such as `--background`, `--card`, `--border`, or `--sidebar`. It overrides only the workflow-related status tokens.

Each derived surface uses the Figma rule:

```css
color-mix(in srgb, var(--workflow-stage-accent) <percentage>, var(--background))
```

For the recommended bordered treatment, the proposal provides:

- a subtle body/lane background;
- a slightly stronger header background;
- a clearly visible border;
- the original accent for dots and decorative elements;
- a contrast-adjusted derivative for foreground text.

The Light accents from the Figma exploration are intentionally not used directly for text: several combinations fall below a 4.5:1 contrast ratio. Light foreground tokens mix 60% of the accent with black; Dark foreground tokens mix 98% of the accent with white. The original colour remains unchanged in `--workflow-*-accent` and `--status-*-dot`.

## Review questions

1. Is the semantic mapping `Backlog → Draft`, `Implement → Running`, `Verify → Waiting`, and `Done → Completed` correct?
2. Should these values override the existing `--status-*` tokens, or should they live under a new `--workflow-*` namespace?
3. Which palette option should move forward?
4. Is `color-mix()` acceptable in the target browser matrix, or should the values be precompiled to static colours?
5. Which application repository and token stylesheet should receive the final change?

## Scope

This is a review package, not a production release. No component markup, behaviour, typography, spacing, or existing failure/cancellation colours are changed.
