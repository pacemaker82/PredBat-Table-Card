# Predbat-Table-Card
A custom Predbat table card that allows flexible column management and styling. The card also supports Predbat's HTML debug mode, and collapsing import/export prices into a single column. The card can switch between light modes or you can force the mode you want through the YAML configuration.

| ![Screenshot of light-mode](https://github.com/pacemaker82/PredBat-Table-Card/blob/main/light-screen.png?raw=true) | ![Screenshot of dark-mode](https://github.com/pacemaker82/PredBat-Table-Card/blob/main/dark-screen.png?raw=true) |
|----------|----------|

## Installation

1. Goto HACS (if you dont have that installed, install HACS)
2. Add a custom repository
3. Add the URL to this repo: `https://github.com/pacemaker82/PredBat-Table-Card`
4. Go back to HACS and search for "Predbat table card"
5. Download and refresh
6. Add the card to your dashboard resources if not already there. Usually located at `/hacsfiles/PredBat-Table-Card/predbat-table-card.js`

## Setup

The following config items can or should be set on the card

| Configuration Item | Required | Value |
|----------|----------|----------|
| `type`   | YES    | `predbat-table-card`    |
| `entity`   | YES    | `predbat.plan_html` or name of the entity holding the Predbat plan HTML    |
| `columns`    | YES    | `time-column` `import-column` `export-column` `import-export-column` `state-column` `limit-column` `pv-column` `load-column` `soc-column` `cost-column` `total-column` <br>Use `car-column` if EV is setup. <br>Provide ***in any order*** you want <br>At least 1 column needs to be used|
| `odd_row_colour`    | NO    | Dark Mode Colour - HEX value e.g. `#FFFFFF` otherwise default colour will be used   |
| `even_row_colour`    | NO    | Dark Mode Colour - HEX value e.g. `#FFFFFF` otherwise default colour will be used   |
| `table_width`    | NO    | From `0` to `100` representing percentage width. If not set default will be used. <br> Card will use the percentage based on the container the card is in. E.g. if you put the card in a single card template and set to `100` it will display on the entire screen   |
| `fill_empty_cells`    | NO    | `true` or `false`. Will add a "-" symbol where data isnt available to clear out empty space   |
| `hide_last_update`    | NO    | `true` or `false`. Will determine if the last update time is shown at the top of the table   |
| `light_mode`    | NO    | Use `light`, `dark`, or `auto` - default is `auto` if you dont set it. Use this to force the mode you want   |
| `odd_row_colour_light`    | NO    | Light Mode Colour HEX value e.g. `#FFFFFF` otherwise default colour will be used   |
| `even_row_colour_light`    | NO    | Light Mode Colour HEX value e.g. `#FFFFFF` otherwise default colour will be used   |
| `debug_prices_only` | NO | `true` or `false`. If HTML debug prices enabled, set to `true` to only show the adjusted prices

You can use `import-export-column` to see both import and export prices in a single column

Use this default card config YAML to get started (paste into the card YAML):

```
type: custom:predbat-table-card
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
fill_empty_cells: true
```

## Custom Setup example

Below shows how you can use any column in any order, just put them in the list how you want them:

```
type: custom:predbat-table-card
entity: predbat.plan_html
columns:
  - time-column
  - state-column
  - soc-column
  - load-column
  - limit-column
  - total-column
odd_row_colour: '#181f2a'
even_row_colour: '#2a3240'
table_width: 50
fill_empty_cells: true
```
