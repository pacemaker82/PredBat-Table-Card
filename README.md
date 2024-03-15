# Predbat-Table-Card
If you're using the excellent [Predbat](https://github.com/springfall2008/batpred) integration in Home Assistant, this custom table card for the Predbat plan maybe for you.

This is a custom [Predbat](https://github.com/springfall2008/batpred) table card that allows flexible column management and styling - meaning you can set which columns you want to see, in which order, and with what styling. The card also supports [Predbat's](https://github.com/springfall2008/batpred) HTML debug mode, and collapsing import/export prices into a single column. The card can switch between light modes or you can force the mode you want through the YAML configuration. The card also supports flexible styling, so you can use a mix of this card's style as well as some of the original Predbat HTML plan style in different columns.

| ![Screenshot of light-mode](https://github.com/pacemaker82/PredBat-Table-Card/blob/main/light-screen-mode.png?raw=true) | ![Screenshot of dark-mode](https://github.com/pacemaker82/PredBat-Table-Card/blob/main/dark-screen.png?raw=true) |
|----------|----------|

## Table of Contents
1. [Installation](#installation)
2. [Card Setup](#card-setup)
3. [Custom Card Setup](#custom-setup-example)
4. [Managing table width for different devices](#managing-table-width-for-different-devices)

## Installation

1. Goto HACS (if you dont have that installed, install HACS)
2. Add a custom repository
3. Add the URL to this repo: `https://github.com/pacemaker82/PredBat-Table-Card`
4. Go back to HACS and search for "Predbat table card"
5. Download and refresh
6. Add the card to your dashboard resources if not already there. Usually located at `/hacsfiles/PredBat-Table-Card/predbat-table-card.js`

## Card Setup

The following config items can or should be set on the card

| Configuration Item | Required | Value |
|----------|----------|----------|
| `type`   | YES    | `predbat-table-card`    |
| `entity`   | YES    | `predbat.plan_html` or name of the entity holding the Predbat plan HTML    |
| `columns`    | YES    | `time-column` `import-column` `export-column` `import-export-column` `state-column` `limit-column` `pv-column` `load-column` `soc-column` `cost-column` `total-column` <br>Use `car-column` if EV is setup. <br> Use `iboost-column` if iBoost is setup <br>Provide ***in any order*** you want <br>At least 1 column needs to be used|
| `odd_row_colour`    | NO    | Dark Mode Colour - HEX value e.g. `#FFFFFF` otherwise default colour will be used   |
| `even_row_colour`    | NO    | Dark Mode Colour - HEX value e.g. `#FFFFFF` otherwise default colour will be used   |
| `table_width`    | NO    | From `0` to `100` representing percentage width. If not set default will be used. <br> Card will use the percentage based on the container the card is in. E.g. if you put the card in a single card template and set to `100` it will display on the entire screen   |
| `fill_empty_cells`    | NO    | `true` or `false`. Will add a "-" symbol where data isnt available to clear out empty space   |
| `hide_last_update`    | NO    | `true` or `false`. Will determine if the last update time is shown at the top of the table   |
| `light_mode`    | NO    | Use `light`, `dark`, or `auto` - default is `auto` if you dont set it. Use this to force the mode you want   |
| `odd_row_colour_light`    | NO    | Light Mode Colour HEX value e.g. `#FFFFFF` otherwise default colour will be used   |
| `even_row_colour_light`    | NO    | Light Mode Colour HEX value e.g. `#FFFFFF` otherwise default colour will be used   |
| `debug_prices_only` | NO | `true` or `false`. If HTML debug prices enabled, set to `true` to only show the adjusted prices. **Important:** The Predbat `HTML Plan debug` mode must be enabled for this to work! | 
| `stack_pills` | NO | `true` or `false`. Set to `false` if you want the price pills to only display on one line, `true` for on top of each other. Default is `true`|
| `old_skool` | NO | Set to `true` if you want to override the **_styling_** of the **entire table** to follow the original Predbat card. This setting still allows for the flexibility of custom columns etc. Overrides any styling settings like light mode, row colours |
| `old_skool_columns` | NO | Like `columns`, use this setting to override specific columns to use the original Predbat card style. `old_skool` setting is ignored if these are set. Supports all the same `columns`. Column order is still set in `columns` not here, this setting just affects the style/appearance. Works in dark and light mode. See [Custom Setup Example](#custom-setup-example) below for details on how to use |
| `hide_empty_columns` | NO | Set to `true` to automatically hide the `car-column` and `iboost-column` if there is no plan for them, i.e. the column is empty of data. The columns will re-appear when Predbat has a plan for them (like when you plug your car back in) | 

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
table_width: 100
fill_empty_cells: true
```

## Custom Setup example

Below shows how you can use any column in any order, just put them in the list how you want them. This example is also showing the `state` and `soc` columns in the style of the original Predbat card.

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
light_mode: light
fill_empty_cells: true
old_skool_columns:
  - state-column
  - soc-column
```

<img width="598" alt="Screenshot 2024-03-09 at 07 53 23" src="https://github.com/pacemaker82/PredBat-Table-Card/assets/157808562/626b2151-b612-4c9c-b9f6-02cf56c960c5">

## Managing table width for different devices

| ![IMG_D1EF0A21CA2E-1](https://github.com/pacemaker82/PredBat-Table-Card/assets/157808562/65a06929-b20c-4fc6-be7b-cfa49b14755b) | <img width="1331" alt="Screenshot 2024-03-11 at 09 51 40" src="https://github.com/pacemaker82/PredBat-Table-Card/assets/157808562/77deb544-998a-4ce8-a548-867f9091b255">|
|----------|----------|

The card has built in logic to reduce column widths the best it can, it will dynamically truncate some labels and column headers too to maximise the real estate. However there is only so much you can do if you choose to show a lot of the Predbat data.

As an alternative, you can use the built in `conditional` card in Home Assistant to make two versions of the Predbat card, one for mobile screen and one for full computer screen (or any size wider than mobile). In the example below, the first version of the card is for mobile phone screen size, limiting the number of columns to see, the second is the full size version showing all the columns. Of course as this card is very flexible you can have different columns in different orders depending on the screen size. Check out the `conditional` card for even more options (like a tablet version etc)

```
type: vertical-stack
cards:
  - type: conditional
    conditions:
      - condition: screen
        media_query: '(min-width: 0px) and (max-width: 767px)'
    card:
      type: custom:predbat-table-card
      entity: predbat.plan_html
      columns:
        - time-column
        - soc-column
        - state-column
        - limit-column
        - total-column
      odd_row_colour: '#181f2a'
      even_row_colour: '#2a3240'
      fill_empty_cells: true
      stack_pills: false
      old_skool_columns:
        - soc-column
        - state-column
  - type: conditional
    conditions:
      - condition: screen
        media_query: '(min-width: 768px)'
    card:
      type: custom:predbat-table-card
      entity: predbat.plan_html
      columns:
        - time-column
        - import-column
        - state-column
        - limit-column
        - soc-column
        - pv-column
        - load-column
        - car-column
        - cost-column
        - total-column
      odd_row_colour: '#181f2a'
      even_row_colour: '#2a3240'
      fill_empty_cells: true
      stack_pills: false
      old_skool_columns:
        - soc-column
        - state-column
```
