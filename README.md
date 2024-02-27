# PredBat-Table-Card
A custom Predbat table card that allows flexible column management and styling

## Installation

1. Install via HACS. Search for Predbat Table Card and install.
2. You may need to add the resource file to your resources area of dashboard

## Setup

The following config items can or should be set on the card

| Confiuration Item | Required | Value |
|----------|----------|----------|
| `type`   | YES    | `predbat-table-card-new`    |
| `entity`   | YES    | `predbat.plan_html` or name of the entity holding the Predbat plan HTML    |
| `columns`    | YES    | `time-column` `import-column` `export-column` `state-column` `limit-column` `pv-column` `load-column` `soc-column` `cost-column` `total-column` <br>Use `car-column` if EV is setup. <br>Provide ***in any order*** you want <br>At least 1 column needs to be used|
| `odd_row_colour`    | NO    | HEX value e.g. `#FFFFFF` otherwise default colour will be used   |
| `even_row_colour`    | NO    | HEX value e.g. `#FFFFFF` otherwise default colour will be used   |
| `table_width`    | NO    | From `0` to `100` representing percentage width. If not set default will be used   |

Use this default card config YAML to get started (paste into the card YAML):

```
type: custom:predbat-table-card-new
entity: predbat.plan_html
columns:
  - time-column
  - import-column
  - export-column
  - state-column
  - limit-column
  - pv-column
  - load-column
  - soc-column
  - cost-column
  - total-column
odd_row_colour: '#181f2a'
even_row_colour: '#2a3240'
table_width: 100
```
