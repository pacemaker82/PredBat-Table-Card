async function fetchEntityHistory(hass, entityId, hours = 1) {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600 * 1000);
  const path = `history/period/${start.toISOString()}?end_time=${end.toISOString()}&filter_entity_id=${entityId}&minimal_response=1&significant_changes_only=1&no_attributes`;
  const data = await hass.callApi("GET", path);
  return (Array.isArray(data) && data[0]) ? data[0] : [];
}

function getLastCompletedOnRun(history) {
  if (!Array.isArray(history) || history.length < 2) return null;

  for (let offIdx = history.length - 1; offIdx >= 0; offIdx--) {
    if (history[offIdx].state !== 'off') continue;

    for (let onIdx = offIdx - 1; onIdx >= 0; onIdx--) {
      const s = history[onIdx].state;
      if (s === 'on') {
        const start = new Date(history[onIdx].last_changed);
        const end   = new Date(history[offIdx].last_changed);
        const ms    = end - start;
        return ms > 0 ? { ms, start, end } : null;
      }
      if (s === 'off') break;
    }
  }
  return null;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m ? `${m}m ${sec}s` : `${sec}s`;
}


class PredbatTableCard extends HTMLElement {

  // The user supplied configuration. Throw an exception and Home Assistant
  // will render an error card.
  setConfig(config) {
    if (!config.entity) {
      throw new Error("You need to set the predbat entity");
    }
    if (!config.columns) {
      throw new Error("You need to define a list of columns (see docs)");
    } else if((config.columns.includes("weather-column") || config.columns.includes("temp-column") || config.columns.includes("rain-column")) && !config.weather_entity) {
        throw new Error("To use weather or temp columns you need to include a weather_entity in your YAML");
    }
    
    this.config = config;

  }    
  
  // Let HA know which editor element to use
  /*
  static getConfigElement() {
    return document.createElement('predbat-card-editor');
  } 
  */
  
  static getConfigForm() {
    return {
      schema: [
        {
          name: "help_text",
          type: "constant",
          value: "",
        },
        { name: "entity", 
            required: true, 
            selector: { 
                entity: {} 
            }, 
            default: "predbat.plan_html",
        }, 
          {
            name: "",
            title: "General Card Settings",
            type: "expandable",
            schema: [
                { name: "fill_empty_cells", selector: { boolean: {} } },
                { name: "show_day_totals", selector: { boolean: {} } },
                { name: "show_plan_totals", selector: { boolean: {} } },
                { name: "show_predbat_version", selector: { boolean: {} } },
                { name: "show_tablecard_version", selector: { boolean: {} } },
                { name: "hide_last_update", selector: { boolean: {} } },
                { name: "use_friendly_states", selector: { boolean: {} } },
                { name: "stack_pills", selector: { boolean: {} } }, 
                { name: "debug_prices_only", selector: { boolean: {} } }, 
                { name: "reset_day_totals", selector: { boolean: {} } }, 
                {
                  name: "row_limit",
                  selector: {
                    number: {
                      min: 1,
                      max: 400,
                      step: 1,                 // allows fractional values (e.g. 12.5)
                      mode: "box",               // shows a numeric input box instead of slider
                    },
                  },
                  default: 100,
                },                
                {
                  name: "battery_capacity",
                  selector: {
                    number: {
                      min: 1,
                      mode: "box", // shows a numeric input box instead of slider 
                      step: 0.01,  
                      unit_of_measurement: "kWh",
                    },
                  },
                },
            ]
          },  
        {
            name: "",
            title: "Card Style Settings",
            type: "expandable",
            schema: [
                {
                    name: "table_width",
                    selector: { number: { min: 10, max: 100, step: 1, unit_of_measurement: "%" } },
                    default: 100,   // starting value
                },                 
                { name: "old_skool", selector: { boolean: {} }, default: false },
                {
                  name: 'old_skool_columns',
                  selector: {
                    select: {
                      multiple: true,
                      mode: 'dropdown',
                      options: [
                        { value: 'time-column', label: 'Time' },
                        { value: 'import-column', label: 'Import' },
                        { value: 'export-column', label: 'Export' },
                        { value: 'import-export-column', label: 'Import & Export' },
                        { value: 'load-column', label: 'Load' },
                        { value: 'pv-column', label: 'PV' },
                        { value: 'state-column', label: 'State' },
                        { value: 'soc-column', label: 'SoC' },
                        { value: 'limit-column', label: 'Limit' },
                        { value: 'cost-column', label: 'Cost' },
                        { value: 'total-column', label: 'Total Cost' },
                        { value: 'car-column', label: 'Car' },
                        { value: 'iboost-column', label: 'iBoost' },
                        { value: 'co2kwh-column', label: 'CO2 kWh' },
                        { value: 'co2kg-column', label: 'CO2 KG' },
                        { value: 'xload-column', label: 'X-Load' },
                        { value: 'clip-column', label: 'Clip' },
                        { value: 'net-power-column', label: 'Net Power' },
                        { value: 'options-popup-column', label: 'Popup Overrides' },
                        { value: 'options-column', label: 'Overrides' },
                      ],
                    },
                  },
                },   
                {
                  name: "font_size",
                  selector: {
                    number: {
                      min: 8,
                      max: 32,
                      step: 0.1,                 // allows fractional values (e.g. 12.5)
                      mode: "box",               // shows a numeric input box instead of slider
                      unit_of_measurement: "px", // optional, just a label suffix
                    },
                  },
                  default: 14,
                }, 
                {
                    name: "light_mode",
                    selector: {
                        select: {
                            multiple: false,
                            options: [
                                { value: 'auto', label: 'Automatic' },
                                { value: 'light', label: 'Light Mode'},
                                { value: 'dark', label: 'Dark Mode'},
                            ],
                        },
                    },
                },
                {
                  name: "color_help_text",
                  type: "constant",
                  value: "",
                },                
                {
                    name: "",
                    type: "grid",
                    schema: [
                        {
                          name: "odd_row_colour",
                          selector: {
                            text: {
                              type: "text",
                            }
                          },
                          default: "#ffffff"
                        }, 
                        {
                          name: "even_row_colour",
                          selector: {
                            text: {
                              type: "text",
                            }
                          },
                          default: "#ffffff"
                        },   
                        {
                          name: "odd_row_colour_light",
                          selector: {
                            text: {
                              type: "text",
                            }
                          },
                          default: "#ffffff"
                        }, 
                        {
                          name: "even_row_colour_light",
                          selector: {
                            text: {
                              type: "text",
                            }
                          },
                          default: "#ffffff"
                        },                          
                    ]
                },
                {
                  name: "color_help_text_more",
                  type: "constant",
                  value: "",
                },                  
            ]
        },          
        {
            name: "",
            title: "Predbat Debug Settings",
            type: "expandable",
            schema: [
                {
                  name: 'debug_columns',
                  selector: {
                    select: {
                      multiple: true,
                      mode: 'dropdown',
                      options: [
                        { value: 'time-column', label: 'Time' },
                        { value: 'import-column', label: 'Import' },
                        { value: 'export-column', label: 'Export' },
                        { value: 'import-export-column', label: 'Import & Export' },
                        { value: 'load-column', label: 'Load' },
                        { value: 'pv-column', label: 'PV' },
                        { value: 'state-column', label: 'State' },
                        { value: 'soc-column', label: 'SoC' },
                        { value: 'limit-column', label: 'Limit' },
                        { value: 'cost-column', label: 'Cost' },
                        { value: 'total-column', label: 'Total Cost' },
                        { value: 'car-column', label: 'Car' },
                        { value: 'iboost-column', label: 'iBoost' },
                        { value: 'co2kwh-column', label: 'CO2 kWh' },
                        { value: 'co2kg-column', label: 'CO2 KG' },
                        { value: 'xload-column', label: 'X-Load' },
                        { value: 'clip-column', label: 'Clip' },
                        { value: 'net-power-column', label: 'Net Power' },
                        { value: 'options-popup-column', label: 'Popup Overrides' },
                        { value: 'options-column', label: 'Overrides' },
                      ],
                    },
                  },
                },            
            ]
        },
        {
            name: "",
            title: "Advanced Settings",
            type: "expandable",
            schema: [
                { name: "weather_entity", selector: { entity: {} } },
                { 
                    name: "path_for_click", 
                    selector: { 
                        text: { 
                            type: "text", 
                        } 
                    }, 
                    default: "/my-dashboard/predbat-plan",
                },
                { name: "bypassRefactor", selector: { boolean: {} } },
            ]
        },
      ],
      computeLabel: (schema) => {
        if (schema.name === "entity") return "Predbat HTML Entity:";
        if (schema.name === "fill_empty_cells") return "Fill Empty Cells?";
        if (schema.name === "show_day_totals") return "Show Day Totals Row?";
        if (schema.name === "show_plan_totals") return "Show Plan Totals Row?";
        if (schema.name === "use_friendly_states") return "Use friendly STATE labels?";
        if (schema.name === "stack_pills") return "Stack Import/Export Pills?";
        if (schema.name === "old_skool") return "Use original Predbat Plan stylesheet? (old_skool mode)";
        if (schema.name === "old_skool_columns") return "Choose specific columns to use original Predbat Plan style";
        if (schema.name === "help_text") return "Important: You must manually set the columns in your card YAML";
        if (schema.name === "table_width") return "Table Width (%)";
        if (schema.name === "font_size") return "Font Size (px)";
        if (schema.name === "row_limit") return "Number of rows to return";
        if (schema.name === "show_predbat_version") return "Show Predbat version?";
        if (schema.name === "show_tablecard_version") return "Show Predbat Table Card version?";
        if (schema.name === "hide_last_update") return "Hide PLAN LAST UPDATED header?";
        if (schema.name === "battery_capacity") return "Battery Capacity";
        if (schema.name === "color_help_text") return "Row colour override settings";
        if (schema.name === "color_help_text_more") return "Override the HEX (e.g, #AA0000) colour values of the rows";
        if (schema.name === "light_mode") return "Card Light Mode";
        if (schema.name === "odd_row_colour") return "Dark Row Colour (odd)";
        if (schema.name === "odd_row_colour_light") return "Light Row Colour (odd)";
        if (schema.name === "even_row_colour") return "Dark Row Colour (even)";
        if (schema.name === "even_row_colour_light") return "Light Row Colour (even)";
        if (schema.name === "debug_prices_only") return "Show Debug Prices Only?";
        if (schema.name === "weather_entity") return "Weather Entity";        
        if (schema.name === "path_for_click") return "Dashboard Path for click";
        if (schema.name === "bypassRefactor") return "Bypass Refactor Code?";
        if (schema.name === "reset_day_totals") return "Reset Total Cost at midnight?";
        
        return undefined;
      },
      computeHelper: (schema) => {
        switch (schema.name) {
          case "entity":
            return "Usually set to \"predbat.plan_html\"";
          case "fill_empty_cells":
            return "This setting fills the column with an icon to fill any empty space";
          case "stack_pills":
            return "Only works when old_skool mode is disabled in style settings";
          case "show_plan_totals":
            return "Show a new row of plan total values for each supported column"; 
          case "show_day_totals":
            return "Show a new row of day total values for each supported column"; 
          case "use_friendly_states":
            return "Attempts to make the STATE column more understandable";
          case "old_skool":
            return "Applies the style to the entire table card, aka old_skool setting. This setting always wins and overrides settings below."; 
          case "old_skool_columns":
            return "Warning: This setting is overridden by the old_skool setting above. Turn that off if you want to set specific columns";       
          case "help_text":
            return "some helpful text"; 
          case "table_width":
            return "Set the overall table width as a percentage.";
          case "font_size":
            return "Adjust the font size used in the table.";
          case "row_limit":
            return "Min: 1, Max: 400";  
          case "show_predbat_version":
            return "Displays the Predbat version at the bottom of the table. Click to Upgrade (if available)";  
          case "show_tablecard_version":
            return "Displays the Predbat Table Card version at the bottom of the table. Click to Upgrade (if available)";  
          case "hide_last_update":
            return "Hides the Plan Last Updated text at the top of the plan";        
          case "battery_capacity":
            return "Shows the kWh capacity of your battery in the SoC column";      
          case "debug_columns":
            return "Choose which columns reflect the HTML Debug Settings when enabled in Predbat";   
          case "debug_prices_only":
            return "If you have enabled Predbat's HTML Plan debug, set to true to only show the adjusted prices, rather than the default (actual and adjusted prices). Important: Only works if HTML Plan debug is enabled";
          case "weather_entity":
            return "Add a weather forecast entity to see the weather for each time slot. Must add weather-column or temp-column to columns to see weather"; 
          case "path_for_click":
            return "Add a dashboard path like /my-dashboard/predbat-plan to be navigated to when you click the plan"; 
          case "bypassRefactor":
            return "Bypasses the new refactored codebase if there is a serious issue you need to get around with Version 1.9x +"; 
          case "reset_day_totals":
            return "Resets the total-column at midnight to £0.00 and increments by cost-column";             
        }
        return undefined;
      },
    };
  }  

  static getStubConfig() {
    return {
      "entity": "predbat.plan_html",
      "columns": [
        "time-column",
        "import-column",
        "export-column",
        "state-column",
        "limit-column",
        "pv-column",
        "load-column",
        "soc-column",
        "cost-column",
        "total-column"
      ],
      "table_width": 100,
      "fill_empty_cells": true
    }
  }
  
    static get properties() {
        return {
            _config: {},
            _hass: {},
        };
    }
    
  constructor() {
    super();
    //this.attachShadow({ mode: 'open' });
    this.forecast = [];
    this.unsubscribe = null;
  }    
    
  // Whenever the state changes, a new `hass` object is set. Use this to
  // update your content.    
    
  set hass(hass) {
    // Initialize the content if it's not there yet.
    if (!this.content) {
      this.innerHTML = `
        <ha-card>
          <div class="card-content" id="predbat-card-content"></div>
        </ha-card>
      `;
      this.content = this.querySelector("div");
    }
    
    const oldHass = this._hass;
    this._hass = hass;
    
    const entityId = this.config.entity;
    const switchEntityId = this.config.car_charge_switch; // optional
    const predbatActiveEntityId = 'switch.predbat_active';
    
    if(oldHass === undefined){
        // Render html on the first load
        if (!this.initialized && this.config.weather_entity) {
            
            this.weatherEntityId = this.config.weather_entity;
            
            const state = hass.states[this.weatherEntityId];
            const stateStr = state ? state.state : "unavailable";
        
            if (stateStr === "unavailable") {
              throw new Error("Weather entity seems to be incorrect or not available");
            } else {           
            
                this.subscribeForecast();
                this.initialized = true;
            }
        }
        this._lastOnText = null;
        this.processAndRender(hass);
    } else {
        const oldEntityUpdateTime = oldHass.states[entityId].last_updated;
        const newEntityUpdateTime = hass.states[entityId].last_updated;
        let carSwitchChanged = false;
        let activeSwitchChanged = false;
        let manualForceChanged = false;
        
        if (predbatActiveEntityId && hass.states[predbatActiveEntityId] && oldHass.states[predbatActiveEntityId]) {
          const oldActive = oldHass.states[predbatActiveEntityId];
          const newActive = hass.states[predbatActiveEntityId];
          activeSwitchChanged = oldActive.last_updated !== newActive.last_updated;
        
          // If we just transitioned ON -> OFF, compute duration immediately
          if (activeSwitchChanged && oldActive.state === 'on' && newActive.state === 'off') {
            const start = new Date(oldActive.last_changed); // when it turned ON
            const end   = new Date(newActive.last_changed); // when it turned OFF
            const ms    = end - start;
            this._lastOnText = ms > 0 ? formatDuration(ms) : '—';
          }
        }
        
        if (switchEntityId && hass.states[switchEntityId] && oldHass.states[switchEntityId]) {
            const oldSwitchTime = oldHass.states[switchEntityId].last_updated;
            const newSwitchTime = hass.states[switchEntityId].last_updated;
            carSwitchChanged = oldSwitchTime !== newSwitchTime;
        }  
        
        const forceEntityObjects = this.getOverrideEntities();
        for (const forceEntity of forceEntityObjects) {
            // forceEntity.entityName
            const oldForce = oldHass.states[forceEntity.entityName].state;
            const newForce = hass.states[forceEntity.entityName].state;
            manualForceChanged = oldForce !== newForce;
            if (manualForceChanged){
                //console.log("MANUAL FORCE CHANGED " + oldForce + " - " + newForce);
                break;
            }
        }        
        
        if (oldEntityUpdateTime !== newEntityUpdateTime || carSwitchChanged || activeSwitchChanged || manualForceChanged) {
            this.processAndRender(hass);
        }
    }
  }
  
  async subscribeForecast() {
    if (this.unsubscribe || !this._hass) return;

    try {
      this.unsubscribe = await this._hass.connection.subscribeMessage(
        (event) => {
          this.forecast = event.forecast || [];
          //console.log(`[${new Date().toLocaleTimeString()}] FORECAST READY FOR RENDER`);
          //console.log(this.forecast);
          this.processAndRender(this._hass);
        },
        {
          type: 'weather/subscribe_forecast',
          entity_id: this.weatherEntityId,
          forecast_type: 'hourly' // or 'hourly'
        }
      );
    } catch (e) {
      console.error('Failed to subscribe to forecast:', e);
    }
  }  

  async disconnectedCallback() {
    if (this.unsubscribe) {
      await this.unsubscribe();
      this.unsubscribe = null;
    }
  }
  
 async processAndRender(hass){
      
    const predbatActiveEntityId = 'switch.predbat_active';

    if(this._lastOnText === null){

        const history = await fetchEntityHistory(this._hass, predbatActiveEntityId, 1);
        const lastRun = getLastCompletedOnRun(history);  
        
        if (lastRun) {
         this._lastOnText = formatDuration(lastRun.ms);
        } else {
         this._lastOnText = '—';
        }
    
    }
    
    console.log(`[${new Date().toLocaleTimeString()}] PROCESS AND RENDER TABLE`);
    console.log(this._lastOnText);

    const entityId = this.config.entity;
    
    const state = hass.states[entityId];
    const stateStr = state ? state.state : "unavailable";

    if (stateStr === "unavailable") {
      throw new Error("Predbat HTML entity is not currently available. Hit REFRESH when it is...");
    }
    
    let columnsToReturn = this.config.columns;
    let rawHTML = hass.states[entityId].attributes.html;
    
    const dataArray = this.getArrayDataFromHTML(rawHTML, hass.themes.darkMode); 
    
    //const dataArray = this.getArrayDataFromRaw(hass.states[entityId].attributes.raw, hass.themes.darkMode);
    
    //filter out any columns not in the data
    columnsToReturn = columnsToReturn.filter(column => {
        if (column === "options-column" || column === "options-popup-column") return true;
        return dataArray[0][column] !== undefined;
    });

    let theTable = document.createElement('table');
    theTable.setAttribute('id', 'predbat-table');
    theTable.setAttribute('cellpadding', '0px');
    let newTableHead = document.createElement('thead');
    
    // set out the data rows
    let newTableBody = document.createElement('tbody');

    let overallTotal = {};
    let dayTotal = {};
    const columnsWithTotals = ["load-column", "pv-column", "car-column", "iboost-column", "net-power-column", 
    "cost-column", "clip-column", "co2kwh-column", "co2kg-column", "xload-column", "limit-column"];
    
    // before we display the rows, lets drop any that the user doesnt want.
    
    if(this.config.row_limit && this.config.row_limit > 0)
        dataArray.length = this.config.row_limit;

    //const useRefactor = this._hass.states['input_boolean.predbat_tablecard_refactor']?.state === 'on';
    
    const useRefactor = !this.config?.bypassRefactor;
    
    // iterate through the data
    dataArray.forEach((item, index) => {
        
        let newRow = document.createElement('tr');
        
        let isMidnight = false;
        columnsToReturn.forEach((column, columnIndex) => { // Use arrow function here
            if(item[column] !== undefined){
                //console.log(column + " " + item[column]);
                if(item["time-column"].value.includes("23:30"))
                    isMidnight = true;
                
                let newColumn;
                if(useRefactor)
                    newColumn = this.getCellTransformationRefactor(item[column], column, hass.themes.darkMode, index, item["time-column"]);
                else 
                    newColumn = this.getCellTransformation(item[column], column, hass.themes.darkMode, index, item["time-column"]);
    
                newRow.appendChild(newColumn);
                
                if(columnsWithTotals.includes(column)){
                    let val = parseFloat(item[column].value.replace(/[⚊↘↗→p☀]/g, ''));
                    if (isNaN(val)) val = 0;
                    
                    overallTotal[column] = (overallTotal[column] || 0) + val;
                    dayTotal[column] = (dayTotal[column] || 0) + val;
                }
                
            } else {
                if(column === "options-column" || column === "options-popup-column"){
                    let newColumn;
                    if(useRefactor)
                        newColumn = this.getCellTransformationRefactor(item[column], column, hass.themes.darkMode, index, item["time-column"]);
                    else
                        newColumn = this.getCellTransformation(item[column], column, hass.themes.darkMode, index, item["time-column"]);
                    newRow.appendChild(newColumn); 
                }
            }
        });
        
        newTableBody.appendChild(newRow);
        
        if(isMidnight){
            
            for (let i = 0; i < 2; i++) {
                newTableBody.appendChild(this.createDividerRows(columnsToReturn.length, hass.themes.darkMode));
            }
            
            if(this.config.show_day_totals === true) {
            
                // Now insert a row for the day total
                let dayTotalsRow = document.createElement('tr');
                dayTotalsRow.classList.add('dayTotalRow');
                
                columnsToReturn.forEach((column, index) => {
                    
                    let totalCell = document.createElement('td');
                    
                    if(columnsWithTotals.includes(column) && column !== 'limit-column'){
                        let returnTotal;
                        if(column === "cost-column"){
                            let formattedCost = "";
                            
                            if (dayTotal[column] < 0) {
                              formattedCost = `-£${(Math.abs(dayTotal[column]) / 100).toFixed(2)}`;
                            } else {
                              formattedCost = `£${(dayTotal[column] / 100).toFixed(2)}`;
                            }
                            returnTotal = `<b>${formattedCost}</b>`;
                        } else
                            returnTotal = `<b>${dayTotal[column].toFixed(2)}</b>`;
                        
                        totalCell.innerHTML = returnTotal;
                    }
                    
                    if(column === "time-column" && index === 0)
                        totalCell.innerHTML = `<b>TOTALS</b>`;                    
            
                    dayTotalsRow.appendChild(totalCell);
                
                });
                
                newTableBody.appendChild(dayTotalsRow);
                for (let i = 0; i < 2; i++) {
                    newTableBody.appendChild(this.createDividerRows(columnsToReturn.length, hass.themes.darkMode));
                }   
            }
        }
    });
    
    // Create total rows if in the config
    
    if(this.config.show_totals === true || this.config.show_plan_totals === true) {
        
        let totalsRow = document.createElement('tr');
        totalsRow.classList.add('totalRow');
        
        columnsToReturn.forEach((column, index) => {
            
            let totalCell = document.createElement('td');
            
            if(column === "time-column" && index === 0)
                totalCell.innerHTML = `<b>PLAN TOTALS</b>`;
                
            if(columnsWithTotals.includes(column) && column !== 'limit-column'){
                let returnTotal;
                if(column === "cost-column"){
                    let formattedCost = "";
                    
                    if (overallTotal[column] < 0) {
                      formattedCost = `-£${(Math.abs(overallTotal[column]) / 100).toFixed(2)}`;
                    } else {
                      formattedCost = `£${(overallTotal[column] / 100).toFixed(2)}`;
                    }
                    returnTotal = `<b>${formattedCost}</b>`;
                } else
                    returnTotal = `<b>${overallTotal[column].toFixed(2)}</b>`;
                
                totalCell.innerHTML = returnTotal;
            }                
    
            totalsRow.appendChild(totalCell);
        
        });
        
        newTableBody.appendChild(totalsRow);
    }   

    let newHeaderRow = document.createElement('tr');
    newTableHead.classList.add('topHeader');   
        
    //create the header rows
    columnsToReturn.forEach((column, index) => {
           //console.log(column + " - " + dataArray[0][column])
    
           let newColumn = document.createElement('th');
            newColumn.innerHTML = this.getColumnDescription(column);
            newHeaderRow.appendChild(newColumn);        

    });
        
    newTableHead.appendChild(newHeaderRow);    
    
    // This section of code is hiding any columns if they have no value (and the user has set them as a column to return)
    
    if(this.config.hide_empty_columns === true){
        
        let indexesToRemove = [];
        columnsToReturn.forEach((column, index) => {
            if(columnsWithTotals.includes(column) && overallTotal[column] === 0)
                indexesToRemove.push(columnsToReturn.indexOf(column));
        });
        
        if(indexesToRemove.length > 0) {
            for (let row of newTableHead.rows) {
                // Hide the cell in the specified column
                indexesToRemove.forEach((columnIndex, index) => {
                    if (row.cells[columnIndex]) {
                        row.cells[columnIndex].style.display = "none";
                    }
                });
            }
            for (let row of newTableBody.rows) {
                // Hide the cell in the specified column
                indexesToRemove.forEach((columnIndex, index) => {
                    if (row.cells[columnIndex]) {
                        row.cells[columnIndex].style.display = "none";
                    }
                });
            }              
        }
    }
    
    
    // If path_for_click config is added, show a pointer on hover over of table, and click to navigate to new view.
    if(this.config.path_for_click && this.config.path_for_click.length > 0){
        theTable.style.cursor = 'pointer';
        theTable.addEventListener("click", () => {
          this.navigateToPath(this.config.path_for_click);  // Replace with your actual path
        });    
    }
    
    theTable.appendChild(newTableHead);    
    theTable.appendChild(newTableBody);
    
    this.content.innerHTML = "";         // Clear existing content

    if(this.config.hide_last_update !== true) {
        
        const lastUpdated = state ? state.last_updated : "Unavailable";
        const time = this.getLastUpdatedFromHTML(lastUpdated);

        if (time !== undefined){
            let lastUpdateHeaderDiv = document.createElement('div');
            
            lastUpdateHeaderDiv.classList.add('lastUpdateRow');
            lastUpdateHeaderDiv.innerHTML = `<b>Plan Last Updated:</b> ${time}. Duration: ${this._lastOnText}`;
            
            if(hass.states[predbatActiveEntityId].state === "on"){
                //console.log("Switch: " + hass.states['switch.predbat_active'].state);
                lastUpdateHeaderDiv.innerHTML += `<ha-icon class="icon-spin" icon="mdi:loading" style="--mdc-icon-size: 18px; margin-left: 4px;" title="Generating next plan"></ha-icon>`;
            }
            
            this.content.appendChild(lastUpdateHeaderDiv);
        
        }
    }      
    
    this.content.appendChild(theTable);  // Add actual DOM node (preserves listeners)
    
    if(this.config.show_predbat_version === true)
        this.content.appendChild(this.createVersionLabelsForFooter("update.predbat_version","Predbat Version", this));
    
    if(this.config.show_tablecard_version === true)
        this.content.appendChild(this.createVersionLabelsForFooter("update.predbat_table_card_update","Predbat Table Card Version", this));

    const styleTag = document.createElement('style');
	styleTag.innerHTML = this.getStyles(this.getLightMode(hass.themes.darkMode));
	this.content.appendChild(styleTag);      
  }
  
  createVersionLabelsForFooter(entity, label, cardContext){
        const version = this._hass.states[entity].attributes.installed_version;
        const latestVersion = this._hass.states[entity].attributes.latest_version;
        
        let lastUpdateHeaderDiv = document.createElement('div');
        
        lastUpdateHeaderDiv.classList.add('versionRow');

        let updateIcon = ``;
        let updateText = ``;
        if(version !== latestVersion){
            updateIcon = `<ha-icon icon="mdi:download-circle-outline" style="color: var(--primary-color); --mdc-icon-size: 18px; margin-left: 4px;" title="Predbat Table Card version ${latestVersion} available"></ha-icon>`;
            updateText = `<span style="color: var(--primary-color);"><b>Version ${latestVersion} available</b></span>`;
            lastUpdateHeaderDiv.style.cursor = "pointer";
            lastUpdateHeaderDiv.addEventListener('click', () => {
                const event = new CustomEvent('hass-more-info', {
                    bubbles: true,
                    composed: true,
                    detail: { entityId: entity }
                });
            
                cardContext.dispatchEvent(event);
            }); 
        }
        
        lastUpdateHeaderDiv.innerHTML = `<b>${label}:</b> ${version}${updateIcon} ${updateText}`;     
        
        return lastUpdateHeaderDiv;
  }
  
  navigateToPath(path) {
    window.history.pushState(null, "", path);
      const event = new CustomEvent("location-changed", {
        bubbles: true,
        composed: true,
      });
      window.dispatchEvent(event);
    }
  
  createDividerRows(columnLength, darkMode){

    let dividerRow = document.createElement('tr');
    dividerRow.classList.add('daySplitter');
        for(let j = 0; j < columnLength; j++) {
            let newCell = document.createElement('td');
            
            if(this.getLightMode(darkMode)){
                newCell.style.backgroundColor = "#e1e1e1"; 
                newCell.style.opacity = 0.4; 
            } else {
                // light mode
                newCell.style.backgroundColor = "var(--primary-color)"; 
                newCell.style.opacity = 1.00; 
            }
            
            newCell.style.height = "1px";
            dividerRow.appendChild(newCell);
        }
    return dividerRow;
     
  }
  
  getLightMode(hassDarkMode){
    let lightMode = "auto";
    let cssLightMode;
    
    //set the light mode if the YAML is present
    if(this.config.light_mode !== undefined)
        lightMode = this.config.light_mode;
        
    switch (lightMode) {
      case "dark":
        cssLightMode = true;
        break;
      case "light":
        cssLightMode = false;
        break;
      default:
        cssLightMode = hassDarkMode;
    }
    return cssLightMode;
  }


  // The height of your card. Home Assistant uses this to automatically
  // distribute all cards over the available columns.
  getCardSize() {
    return 3;
  }
  
isVersionGreater(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return true;
    if (na < nb) return false;
  }
  return false; // equal
} 

getTimeframeForOverride(timeString) {
  const predBatVersion =
    this._hass.states["update.predbat_version"].attributes.installed_version;

  // Match either "Wed 08:05" or "08:05"
  const match = timeString.match(/^(?:(\w{3})\s)?(\d{2}):(\d{2})$/);
  if (!match) return null;

  const day = match[1] || null;
  let hours = parseInt(match[2], 10);
  let minutes = parseInt(match[3], 10);

  // Floor to the nearest half hour
  minutes = minutes >= 30 ? 30 : 0;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");

  // New format if version > v8.28.2 and a day is present
  if (this.isVersionGreater(predBatVersion, "v8.28.1"))
    return `${day} ${hh}:${mm}`;

  // Old format
  return `${hh}:${mm}:00`;
}

  getArrayForEntityForceStates(entity){
      
      let entityState = entity.state;
      return entityState.replace(/^\+/, '').split(',');
  }
  
    createButtonForOverrides(entityObject, timeForSelectOverride, iconSize, textColor, hideLabel, isAllowed, fromPopup = false) {
      const key = entityObject.entityName.replace('select.predbat_manual_', '');
    
      const iconOpacityOff = 1.00;
      const iconOpacityOn = 1.00;
      const iconColorOff = "rgb(75, 80, 87)";
      const iconColorOn = "rgb(58, 238, 133)";
      const snowIconColorOn = "#000000";
      const snowIconColorOff = "#FFFFFF";
    
      const settings = this.getArrayForEntityForceStates(this._hass.states[entityObject.entityName]);
      const isActive = settings.includes(timeForSelectOverride);
    
      const iconColor = isAllowed ? (isActive ? iconColorOn : iconColorOff) : iconColorOff;
      const iconOpacity = isAllowed ? (isActive ? iconOpacityOn : iconOpacityOff) : '0.25';
      const iconCursor = isAllowed ? 'pointer' : 'not-allowed';
      
      const snowIconColor = isActive ? snowIconColorOn : snowIconColorOff;
      const snowOpacity = isAllowed ? '0.9' : '0.25';      
      
      let snowflakeIcon = null;
    
      // Main container: vertical layout
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.style.width = iconSize + "px";
      //container.style.margin = '0 4px';
    
      // Icon wrapper for potential overlay
      const iconWrapper = document.createElement('div');
      iconWrapper.style.position = 'relative';
      iconWrapper.style.width = iconSize + "px";
      iconWrapper.style.height = iconSize + "px";
    
      // Main icon
      const iconEl = document.createElement('ha-icon');
      iconEl.setAttribute('title', entityObject.entityTitle);
      iconEl.setAttribute('icon', entityObject.entityIcon);
      iconEl.style.cursor = iconCursor;
      iconEl.style.opacity = iconOpacity;
      iconEl.style.color = iconColor;
      iconEl.style.setProperty('--mdc-icon-size', iconSize + "px");
      iconEl.style.width = iconSize + "px";
      iconEl.style.height = iconSize + "px";
      
      if(isAllowed) {   
    
      // Click handler ONLY if allowed
      
        iconEl.addEventListener('click', () => {
          const currentSettings = this.getArrayForEntityForceStates(this._hass.states[entityObject.entityName]);
          const isActive = currentSettings.includes(timeForSelectOverride);
        
          if (fromPopup) {
            const parent = container.parentElement;
            if (parent) {
              const allButtons = parent.querySelectorAll('[data-force-key]');
              allButtons.forEach((btn) => {
                const keyAttr = btn.dataset.forceKey;
                if (keyAttr === key) return;
        
                const icon = btn.querySelector('ha-icon');
                if (icon) {
                  icon.style.opacity = iconOpacityOff;
                  icon.style.color = iconColorOff;
                }
        
                const snowflake = btn.querySelector('ha-icon[icon="mdi:snowflake"]');
                if (snowflake) {
                  snowflake.style.color = snowIconColorOff;
                }
              });
            }
          }
            if(isAllowed){
                  if (isActive) {
        
                    iconEl.style.opacity = iconOpacityOff;
                    iconEl.style.color = iconColorOff;
                    if (snowflakeIcon) snowflakeIcon.style.color = snowIconColorOff;
                
                    const updatedSettings = currentSettings.filter(t => t !== timeForSelectOverride);
                
                    this._hass.callService('select', 'select_option', {
                      entity_id: entityObject.entityName,
                      option: 'off'
                    });
                
                    for (const time of updatedSettings) {
                      this._hass.callService('select', 'select_option', {
                        entity_id: entityObject.entityName,
                        option: time
                      });
                    }
                  } else {
                    iconEl.style.opacity = iconOpacityOn;
                    iconEl.style.color = iconColorOn;
                    if (snowflakeIcon) snowflakeIcon.style.color = snowIconColorOn;
                
                    this._hass.callService('select', 'select_option', {
                      entity_id: entityObject.entityName,
                      option: timeForSelectOverride
                    });
                  }
            }
        });
    
      }
      
      iconWrapper.appendChild(iconEl);
    
      // Overlay snowflake if applicable
      if (key === 'freeze_charge' || key === 'freeze_export') {
          
        snowflakeIcon = document.createElement('ha-icon');
        snowflakeIcon.setAttribute('icon', 'mdi:snowflake');
        snowflakeIcon.setAttribute('title', entityObject.entityTitle);
        snowflakeIcon.style.setProperty('--mdc-icon-size', iconSize/3 + 'px');
        snowflakeIcon.style.color = snowIconColor;
        snowflakeIcon.style.position = 'absolute';
        snowflakeIcon.style.top = (iconSize/3)-10 + 'px';
        snowflakeIcon.style.left = iconSize/3 + 'px';
        snowflakeIcon.style.opacity = snowOpacity;
        snowflakeIcon.style.cursor = 'pointer';
        snowflakeIcon.style.pointerEvents = 'none';

        iconWrapper.appendChild(snowflakeIcon);
      }
    
      // Label
      const label = document.createElement('div');
      label.textContent = key.replace(/_/g, ' ');
      label.style.fontSize = '8px';
      label.style.textTransform = 'uppercase';
      label.style.color = textColor;
      label.style.textAlign = 'center';
      label.style.marginTop = '2px';
      label.style.whiteSpace = 'normal';      // Allow wrapping
      label.style.wordBreak = 'break-word';   // Break long words if needed
      label.style.width = '100%';             // Take full width of parent      
    
      // Assemble
      container.appendChild(iconWrapper);
      if(!hideLabel)
        container.appendChild(label);
        
      container.dataset.forceKey = key;
      return container;
    }  
    
  getOverrideEntities() {
        const forceEntityArray = [
          "select.predbat_manual_demand",
          "select.predbat_manual_charge",
          "select.predbat_manual_export",
          "select.predbat_manual_freeze_charge",
          "select.predbat_manual_freeze_export"
        ];
        
        const titleMap = {
          demand: "Force Manual Demand",
          charge: "Force Manual Charge",
          export: "Force Manual Export",
          freeze_export: "Force Freeze Export",
          freeze_charge: "Force Freeze Charge"
        };
        
        const iconMap = {
          demand: "mdi:home-battery",
          charge: "mdi:battery-plus",
          export: "mdi:battery-minus",
          freeze_export: "mdi:battery-minus",
          freeze_charge: "mdi:battery-plus"          
        };
        
        const forceEntityObjects = forceEntityArray.map(entityName => {
          const key = entityName.replace('select.predbat_manual_', '');  // e.g., "freeze_export"
          return {
            entityName,
            entityIcon: iconMap[key],
            entityTitle: titleMap[key]
          };
        }); 
        
        return forceEntityObjects;
  }
  
  createPopUpForOverrides(timeForSelectOverride, timestamp, isAllowed) {
      
      const forceEntityObjects = this.getOverrideEntities();
     
          // Check if modal already exists
          if (document.getElementById('custom-modal-overlay')) return;
        
          // Create overlay
          const overlay = document.createElement('div');
          overlay.id = 'custom-modal-overlay';
          overlay.style.position = 'fixed';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.width = '100vw';
          overlay.style.height = '100vh';
          overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
          overlay.style.display = 'flex';
          overlay.style.alignItems = 'center';
          overlay.style.justifyContent = 'center';
          overlay.style.zIndex = '10000';
          overlay.style.opacity = '0';
          overlay.style.transition = 'opacity 200ms ease-in-out';
        
          // Create modal box
          const modalBox = document.createElement('div');
            modalBox.style.background = 'rgba(0, 0, 0, 0.8)';
            modalBox.style.padding = '20px 40px 20px 40px';
            modalBox.style.borderRadius = '8px';
            modalBox.style.border = "2px solid var(--text-primary-color)";
            modalBox.style.boxShadow = '0 2px 10px rgba(0,0,0,1)';
            modalBox.style.display = "flex";
            modalBox.style.flexDirection = 'column';
            modalBox.style.position = 'relative';
          
          const headerRow = document.createElement('div');
            headerRow.style.display = 'flex';
            headerRow.style.justifyContent = 'space-between';
            headerRow.style.alignItems = 'center';
            headerRow.style.paddingBottom = '20px';
          
          const titleBox = document.createElement('div');
          titleBox.style.color = 'var(--text-primary-color)';
          titleBox.innerHTML = timestamp.value;
          titleBox.style.width = '100%';
            titleBox.style.display = 'flex';
            titleBox.style.justifyContent = 'center';   // horizontal center
            titleBox.style.alignItems = 'center';       // vertical center
          titleBox.style.flex = '1';
          titleBox.style.fontSize = '16px';
          titleBox.style.fontWeight = 'bold';
          titleBox.style.textShadow = '1px 1px 1px black';
          
          const closeBox = document.createElement('div');
          closeBox.style.position = 'absolute';
          closeBox.style.top = '5px';
          closeBox.style.right = '5px';
          
            const closeButton = document.createElement('ha-icon');
            closeButton.setAttribute('title', "Battery Overrides");
            closeButton.setAttribute('icon', "mdi:close-circle-outline");
            closeButton.style.cursor = 'pointer';
            closeButton.style.margin = '0 2px';
            closeButton.style.color = "var(--text-primary-color)";
            closeButton.style.setProperty('--mdc-icon-size', '40px');
            closeButton.id = 'modal-close-btn'; 
            
            closeBox.appendChild(closeButton);
          
          headerRow.appendChild(titleBox);
          
          modalBox.appendChild(closeBox);
          modalBox.appendChild(headerRow);
          
          // Add the buttons to the popup
          
          const buttonBox = document.createElement('div');
            buttonBox.style.display = 'flex';
            buttonBox.style.justifyContent = 'space-between';
            buttonBox.style.alignItems = 'flex-start';   
            
          if(isAllowed){
            
            // Only create the buttons if allowed
            for (const forceEntity of forceEntityObjects) {
                // Create Icon
                const icon = this.createButtonForOverrides(forceEntity, timeForSelectOverride, '40', 'var(--text-primary-color)', false, isAllowed, true);
                // Append to DOM
                //icon.style.border = '1px solid white';
                buttonBox.appendChild(icon);            
            }
          } else {
              buttonBox.style.textAlign = "center";
              buttonBox.style.color = "#FFFFFF";
              buttonBox.innerHTML = "This slot cannot currently be overridden. <br>Overrides will be available as the day progresses.";
          }
        
            modalBox.appendChild(buttonBox);        
          
          
          // Add modal to overlay
          overlay.appendChild(modalBox);
          document.body.appendChild(overlay);
          
            // Trigger fade-in
            void overlay.offsetWidth;  // Force reflow
            overlay.style.opacity = '1';              
        
            // Close handler
            document.getElementById('modal-close-btn').addEventListener('click', () => {
              overlay.remove();
              document.removeEventListener('keydown', escHandler);
            });
            
            // Close on click outside modal
            overlay.addEventListener('click', (e) => {
              if (e.target === overlay) {
                overlay.remove();
                document.removeEventListener('keydown', escHandler);
              }
            });
            
            // Close on Escape key
            const escHandler = (e) => {
              if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', escHandler);
              }
            };
            document.addEventListener('keydown', escHandler);      
  }
  
  checkRowIsAllowedForOverride(forceEntityObjects, timeForSelectOverride, itemIndex) {
    let isAllowed = false;
    for (const forceEntity of forceEntityObjects) {
        const allowedOptions = this._hass.states[forceEntity.entityName].attributes.options;
        if(itemIndex <= allowedOptions.length-2)
            isAllowed = allowedOptions.includes(timeForSelectOverride);
        if(isAllowed)
            break;
    }  
    return isAllowed;
  }
  
    replaceArrowsWithIcons(theItem) {
      const val = theItem;
    
      // Find the first arrow (↘ ↗ →). Adjust the regex if you want a different priority.
      const m = val.match(/[↘↗→]/);
    
      const iconName = m ? ({
        '↘': 'mdi:arrow-down-thin',
        '↗': 'mdi:arrow-up-thin',
        '→': 'mdi:arrow-right-thin'
      }[m[0]]) : null;
    
      const theArrowIcon = iconName
        ? `<ha-icon icon="${iconName}" style="margin:0 -2px;"></ha-icon>`
        : '';
    
      const rawValue = val.replace(/[↘↗→]/g, '');
      return [rawValue, theArrowIcon];
    }
    
    getFriendlyNamesForState(state){
        let friendlyText = state;
        
        friendlyText = friendlyText.replace('Force Dischrg', 'Discharge');
        friendlyText = friendlyText.replace('Force Charge', 'Charge');
        //friendlyText = friendlyText.replace('Exp🐌', 'Export');
        
        
        if(friendlyText.includes("ⅎ")){
            friendlyText = friendlyText.replace('Exp', 'Export');
            friendlyText = "Manually Forced " + friendlyText;
            if(!friendlyText.includes("Charge") && !friendlyText.includes("Discharge") && !friendlyText.includes("Export"))
                friendlyText = friendlyText + "Demand";
            friendlyText = friendlyText.replace('ⅎ', '');
        } else {
            if (/^[↘↗→]$/.test(state)) {
                friendlyText = friendlyText.replace('↘', 'Discharging');
                friendlyText = friendlyText.replace('↗', 'Charging');
                friendlyText = friendlyText.replace('→', 'Idle');
            }
            friendlyText = friendlyText.replace('FrzDis', 'Charging Paused');
            friendlyText = friendlyText.replace('FrzExp', 'Charging Paused');
            friendlyText = friendlyText.replace('FrzChrg', 'Maintaining SoC'); //FreezeChrg
            friendlyText = friendlyText.replace('HoldChrg', 'Maintain SoC at Limit'); //HoldChrg
            friendlyText = friendlyText.includes("NoCharge") ? friendlyText.replace('NoCharge','Charge to Limit') : friendlyText.replace('Charge', 'Planned Charge');
            friendlyText = friendlyText.replace('Discharge', 'Planned Export'); //Discharge
            friendlyText = friendlyText.replace(/Export|Exp/g, 'Planned Export'); // Exp or Export
            friendlyText = friendlyText.replace('Alert Charge', 'Planned Charge ⚠'); // Alert Charge
            friendlyText = friendlyText.replace(/Charge|Chrg/g, 'Planned Charge'); // Chrg or Charge
        }   
        friendlyText = friendlyText.replace(/[↘↗→]/g, '');
        return friendlyText;
    }
    
    getCellsForSplitCell(theItem, newCell){

            newCell.style.minWidth = "186px";
            if(this.config.use_friendly_states === true)
                newCell.style.minWidth = "276px";
            newCell.style.paddingLeft = "0px";
            newCell.style.paddingRight = "0px";
            
            let chargeString = "Charge";
            if(theItem.value === "Both-Chg" || theItem.value === "Both-Dis" || theItem.value === "Both-Idle" || theItem.value === "Both-Dis-Snail")
                chargeString = "";
            
            let dischargeString = "Export";
            
            if(this.isSmallScreen() && (this.config.use_friendly_states === false || this.config.use_friendly_states === undefined)){
                
                if(theItem.value === "Both") {
                    chargeString = "Chg";
                    dischargeString = "Exp";
                }
                
                if(theItem.value === "Both-Chg" || theItem.value === "Both-Dis" || theItem.value === "Both-Idle" || theItem.value === "Both-Dis-Snail") {
                    dischargeString = "Exp";                        
                }
                
                newCell.style.minWidth = "110px";
            }
            
            if(this.config.use_friendly_states === true && this.isSmallScreen() === false){
                if(theItem.value === "Both")
                    chargeString = "Planned Charge";
                else if(theItem.value === "Both-Chg")
                    chargeString = "Charging";
                else if(theItem.value === "Both-Dis")
                    chargeString = "Discharging";
                    
                dischargeString = "Planned Export";                    
            } else if(this.config.use_friendly_states === true && this.isSmallScreen() === true){
                if(theItem.value === "Both")
                    chargeString = "Plnd Chg";
                else if(theItem.value === "Both-Chg")
                    chargeString = "Chg";    
                else if(theItem.value === "Both-Dis" || theItem.value === "Both-Dis-Snail")
                    chargeString = "Dis"; 
                    
                dischargeString = "Plnd Dis"; 
                newCell.style.minWidth = "110px";
            }
            
            let chargeBackgroundColor = "background-color:#3AEE85;";
            let chargeTextColor = "color: #000000;";
            if(theItem.value === "Both-Idle" || theItem.value === "Both-Dis" || theItem.value === "Both-Chg" || theItem.value === "Both-Dis-Snail"){
                chargeBackgroundColor = "background-color:transparent;";
                chargeTextColor = "color: var(--primary-text-color)";
            }
            let chargeIcon;
            if(theItem.value === "Both" || theItem.value === "Both-Chg")
                chargeIcon = '<ha-icon icon="mdi:arrow-up-thin" style="margin: 0 0 0 -5px"></ha-icon>';
            else if(theItem.value === "Both-Idle")
                chargeIcon = '<ha-icon icon="mdi:arrow-right-thin" style="margin: 0 0 0 -3px"></ha-icon>';
            else if(theItem.value === "Both-Dis" || theItem.value === "Both-Dis-Snail")
                chargeIcon = '<ha-icon icon="mdi:arrow-down-thin" style="margin: 0 0 0 -5px"></ha-icon>';
            
            let snail = ``;
            if(theItem.value === "Both-Dis-Snail")
                snail = `<ha-icon icon="mdi:snail" title="Low Power Mode" style="--mdc-icon-size: 14px;"></ha-icon>`;
             
            return `<div style="width: 100%; height: 100%;" id="${theItem.value}">
            <div style='${chargeBackgroundColor} width: 50%; height: 100%; float: left; display: flex; align-items: center; justify-content: center; ${chargeTextColor}'>${chargeString}${chargeIcon}</div>
            <div style='background-color:#FFFF00; width: 50%; height: 100%; float: left; display: flex; align-items: center; justify-content: center; color: #000000;'>${dischargeString}<ha-icon icon="mdi:arrow-down-thin" style="margin: 0 0 0 -5px"></ha-icon>${snail}</div>
            </div>`;        
    }
  
  getCellTransformationRefactor(theItem, column, darkMode, itemIndex, timestamp) {
      
        let newCell = document.createElement('td');
        let newContent = (typeof theItem?.value === 'string') ? theItem.value.trim() : theItem?.value ?? '';
        
        let rawValue = theItem.value;
        let debugValue;
        let hasBoldTags = false, hasItalicTags = false;
        const wrap = (text, tag) => `<${tag}>${text}</${tag}>`;
        
        const timeForSelectOverride = this.getTimeframeForOverride(timestamp.value);
        const forceEntityObjects = this.getOverrideEntities(); 
        const isAllowed = this.checkRowIsAllowedForOverride(forceEntityObjects, timeForSelectOverride, itemIndex);          
        
        const nonDataColumns = ['options-column', 'options-popup-column'];
        const isNonDataColumn = nonDataColumns.includes(column);
        
        const columnsWithCustomTransformation = ['time-column', 'import-column', 'export-column', 'limit-column', 'soc-column', 
        'weather-column', 'rain-column', 'temp-column', 'state-column', 'cost-column', 'options-column', 'options-popup-column',
        'pv-column', 'import-export-column', 'car-column'];
        
        const bothValues = ["Both", "Both-Idle", "Both-Chg", "Both-Dis", "Both-Dis-Snail"];
        const isBothField = bothValues.includes(theItem?.value);
        
        // This var will be used to collect the different parts of the response and build at the end.
        let cellResponseArray = [];
        
        // Old Skool Configuration
        
        let useOldSkool = false;
        if((this.config.old_skool || this.config.old_skool_columns?.includes(column)) && !isNonDataColumn) {
            if(!isBothField)
                newCell.style.backgroundColor = theItem.color;
            if(theItem.color)
                newCell.style.color = "#000000";
            useOldSkool = true;
        } else if(!isNonDataColumn) {
            if(theItem.color)
                newCell.style.color = theItem.color
        }
        
        if((isNonDataColumn && this.config.old_skool) || (this.config.old_skool && column === 'import-export-column')) {
            newCell.style.backgroundColor = "#FFFFFF";
            useOldSkool = true;
            newCell.style.color = "#000000";
        }
        
        // clean string formatting from predbat to get raw value
        // Organise Debug things...
        
        let hasDebug = false;
        const useDebug = (this.config.debug_columns !== undefined && this.config.debug_columns.indexOf(column) > -1);
        let pricesStringFromRaw;
        
        if(!isNonDataColumn && typeof theItem.value === 'string'){
         
            rawValue = theItem.value.replace(/[↘↗→☀ ]/g, '').trim();
            rawValue = rawValue.replace(/<b>(.*?)<\/b>/g, '$1');
            rawValue = rawValue.replace(/<i>(.*?)<\/i>/g, '$1');
            hasBoldTags = /<b>.*?<\/b>/.test(theItem.value);
            hasItalicTags = /<i>.*?<\/i>/.test(theItem.value);
            
            pricesStringFromRaw = rawValue;
            
            //debug
            hasDebug = (theItem.value.includes("(") && theItem.value.includes(")"));
            if(hasDebug){
                
                const match = rawValue.match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/);
                if(match) {
                    rawValue = match?.[1] ?? rawValue;
                    debugValue = match[2];
                }
                
                if(match === null){
                    console.log("Raw: ", rawValue);
                    console.log("match: ", match);
                }
            }
        }
        

        // Column Specific Configuration
        // These are the custom column treatments, must be included in the array first, then specifically called out in the IF statement
        
        if(columnsWithCustomTransformation.includes(column)){

            // Time Column time-column
            
            if(column === "time-column") {
            
                if (this.config.force_single_line)
                    newCell.style.whiteSpace = "nowrap";
                
                newCell.style.width = "70px";
                    
                // make time column tap/clickable for override pop up
                
                const columnsToReturn = this.config.columns;
                const hasNonData = nonDataColumns.some(col => columnsToReturn.includes(col));

                if(column === "time-column" && !hasNonData) {
                    newCell.style.cursor = 'pointer';
                    for (const forceEntity of this.getOverrideEntities()) {
                        const settings = this.getArrayForEntityForceStates(this._hass.states[forceEntity.entityName]);
                        const isActive = settings.includes(this.getTimeframeForOverride(timestamp.value));
                        if(isActive && isAllowed){
                            newCell.style.color = "rgb(58, 238, 133)";
                            break;
                        }
                    }         
                    newCell.addEventListener('click', () => {
                        this.createPopUpForOverrides(this.getTimeframeForOverride(timestamp.value), timestamp, isAllowed);
                    });        
                }          
                
                cellResponseArray.push(theItem.value);
            
            }
            
            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            
            // Car Column           
            
            if(column === "car-column") {
                //newCell.style.color = "var(--primary-text-color)";
                let additionalIcon = "";
                
                if(this.config.car_charge_switch){
                    const entity = this._hass.states[this.config.car_charge_switch];
                    if (entity && entity.state === 'on' && itemIndex === 0) {
                        additionalIcon = '<ha-icon class="pulse-icon" icon="mdi:ev-plug-type2" style="--mdc-icon-size: 16px; margin-top: -2px; margin-left: 2px;"></ha-icon>';
                    }
                }
                
                cellResponseArray.push(`<div class="iconContainer">${theItem.value}${additionalIcon}</div>`);
            
            }            
            
            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            
            // Options Columns 
            
            if(column === "options-popup-column" || column === "options-column"){
                
                if(column === "options-popup-column") {
                    
                    const iconSize = 24;
                    const iconOpacity = isAllowed ? '0.8' : '0.25';
                    const iconPointer = isAllowed ? 'pointer' : 'not-allowed';
                    
                    // CREATE THE ICON
                    const iconEl = document.createElement('ha-icon');
                    iconEl.setAttribute('title', "Battery Overrides");
                    iconEl.setAttribute('icon', "mdi:application-edit-outline");
                    iconEl.style.cursor = iconPointer;
                    iconEl.style.opacity = iconOpacity;
                    iconEl.style.fill = "var(--text-primary-color)";
                    iconEl.style.setProperty('--mdc-icon-size', iconSize + 'px');
                    
                    for (const forceEntity of forceEntityObjects) {
                        const settings = this.getArrayForEntityForceStates(this._hass.states[forceEntity.entityName]);
                        const isActive = settings.includes(timeForSelectOverride);
                        if(isActive && isAllowed){
                            iconEl.style.color = "rgb(58, 238, 133)";
                            iconEl.style.opacity = 1.0;
                            break;
                        }
                    }            
                    
                    // Add click handler
                    iconEl.addEventListener('click', () => {
                        this.createPopUpForOverrides(this.getTimeframeForOverride(timestamp.value), timestamp, isAllowed);
                    });
                    
                    newCell.style.height = (iconSize+10) + 'px';
                    newCell.appendChild(iconEl);        
                }
                
                if(column === "options-column"){
                    
                    const headerRow = document.createElement('div');
                    headerRow.style.display = 'flex';
                    headerRow.style.justifyContent = 'space-between';
                    headerRow.style.alignItems = 'flex-start';
                    
                    for (const forceEntity of forceEntityObjects) {
                        // Create Icon
                        const icon = this.createButtonForOverrides(forceEntity, timeForSelectOverride, '24', 'var(--primary-text-color)', true, isAllowed, true);
                        // Append to DOM
                        icon.style.width = '34px';
                        headerRow.appendChild(icon);            
                    }
                    
                    newCell.style.width = '170px';
                    newCell.appendChild(headerRow);     
            
                }
                
            }
            
            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            
            // Import Export Column
            
            if(column === "import-export-column"){
                let newPills = "";
                let newPillsNoContainer = "";
                theItem.forEach((item, index) => {
                
                    let contentWithoutTags = pricesStringFromRaw;
                    let priceStrings;
                    
                    if(this.config.debug_prices_only === true){
                        // force debug price pill only
                        
                        priceStrings = this.getPricesFromPriceString(contentWithoutTags, hasBoldTags, hasItalicTags, true);
                        newPills += '<div style="height: 26px; align-items: center;">' + this.getTransformedCostToPill({"value": priceStrings[1], "color": item.color}, darkMode) + '</div>';
                        newPillsNoContainer += this.getTransformedCostToPill({"value": priceStrings[1], "color": item.color}, darkMode);
        
                    } else {
                        
                        let numberOfPrices = theItem.length;
                        
                        
                        newPills += '<div style="height: 26px; align-items: center;">' + this.getTransformedCostToPill(item, darkMode) + '</div>';
                        newPillsNoContainer += this.getTransformedCostToPill(item, darkMode);
                    }
                    
                });
                
                if(this.config.stack_pills === false){
                    cellResponseArray.push('<div class="iconContainer">' + newPillsNoContainer + '</div>');
                } else {
                    cellResponseArray.push('<div class="multiPillContainer">' + newPills + '</div>');
                }                
            }
                
    
            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            
            // Import Column import-column
            
            if(column === "import-column" || column === "export-column"){
                
                // If oldSkool do something different
                if(useOldSkool){
                    if(hasDebug && useDebug)
                        cellResponseArray.push(theItem.value);
                    else {
                        if (hasBoldTags) rawValue = wrap(rawValue, 'b');
                        if (hasItalicTags) rawValue = wrap(rawValue, 'i');
                        cellResponseArray.push(rawValue);
                    }
                        
                } else {
                    // manage debug price pills appropriately
                    // debug_prices_only | true | false
                    
                    let contentWithoutTags = pricesStringFromRaw;
                    
                    if(hasDebug && useDebug){
                        // if debug prices are present based on ( ) search
                        // AND YAML config has debug_columns
                        // AND YAML config has specific column for debug_columns
                        // THEN SHOW THE DEBUG
                        
                        let newPills = "";
                        
                        // TEST
                        //contentWithoutTags = "-1.23? ⚖ (-3.45)";
                        
                        let priceStrings;
                        if(this.config.debug_prices_only === true){
                            // force debug price pill only
                            priceStrings = this.getPricesFromPriceString(contentWithoutTags, hasBoldTags, hasItalicTags, true);
                            cellResponseArray.push('<div class="iconContainer">' + this.getTransformedCostToPill({"value":priceStrings[1], "color":theItem.color}, darkMode) + '</div>');
                        
                        } else {
                            priceStrings = this.getPricesFromPriceString(contentWithoutTags, hasBoldTags, hasItalicTags, false);
                
                                if(this.config.stack_pills === false){
                                    cellResponseArray.push('<div class="iconContainer">' + this.getTransformedCostToPill({"value":priceStrings[0], "color":theItem.color}, darkMode) 
                                    + this.getTransformedCostToPill({"value":priceStrings[1], "color":theItem.color}, darkMode) 
                                    + '</div>');
                                } else {
                                    newPills += '<div style="height: 26px; align-items: center;">' + this.getTransformedCostToPill({"value":priceStrings[0], "color":theItem.color}, darkMode) + '</div>';
                                    newPills += '<div style="height: 26px; align-items: center;">' + this.getTransformedCostToPill({"value":priceStrings[1], "color":theItem.color}, darkMode) + '</div>';
                                    cellResponseArray.push('<div class="multiPillContainer">' + newPills + '</div>');                        
                                }
                        }
                        
                    } else if(hasDebug){
            
                        // TEST
                        //contentWithoutTags = "-1.23? ⚖ (-3.45)";
                        
                       let priceStrings = this.getPricesFromPriceString(contentWithoutTags, hasBoldTags, hasItalicTags, this.config.debug_prices_only);
                       cellResponseArray.push('<div class="iconContainer">' + this.getTransformedCostToPill({"value":priceStrings[0], "color":theItem.color}, darkMode) + '</div>');
                        
                    } else {
            
                        cellResponseArray.push('<div class="iconContainer">' + this.getTransformedCostToPill(theItem, darkMode) + '</div>');
                    }

                }
                
            }
            
            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            
            // Cost Column
            
            if(column === "cost-column"){
                
                let costText = theItem.value;
                cellResponseArray = this.replaceArrowsWithIcons(theItem.value);
                cellResponseArray[0] = cellResponseArray[0].replace(' ', '');

            }            
            
            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            
            // State Column
            
            if(column === "state-column"){
                
                let stateText;
 
                if(useOldSkool){
                    
                    if(isBothField){
                    
                        cellResponseArray.push(this.getCellsForSplitCell(theItem, newCell));
                        
                    } else {
                        
                        stateText = theItem.value.replace(/[↘↗→ⅎ🐌⚠]/g, '').trim();
                        stateText = this.adjustStatusFields(stateText);
                        if(this.config.use_friendly_states)
                            stateText = this.getFriendlyNamesForState(theItem.value);
                        
                        cellResponseArray = this.replaceArrowsWithIcons(theItem.value);
                        cellResponseArray[0] = stateText;
                    }
                } else {
                    
                    let snail = ``;
                    if(theItem.value.includes("🐌")){
                        snail = `<ha-icon icon="mdi:snail" title="Low Power Mode" style="--mdc-icon-size: 18px;"></ha-icon>`;
                    }
                        
                    stateText = theItem.value.replace(/[↘↗→ⅎ🐌⚠]/g, '').trim();
                    
                    let weatherAlert = ``;
                    if(theItem.value.includes("⚠"))
                        weatherAlert = `<ha-icon icon="mdi:alert-outline" title="Weather Alert" style="--mdc-icon-size: 18px;"></ha-icon>`;
                    
                    stateText = this.adjustStatusFields(stateText);
                    
                    let additionalArrow = "";
                    newCell.setAttribute('style', 'color: var(--energy-battery-out-color)');
            
                    if(theItem.value === "↘" || theItem.value === "↗" || theItem.value === "→"){
                        let tooltip = "Running Normally";
                        additionalArrow = `<ha-icon icon="mdi:home-lightning-bolt" title="${tooltip}" style="--mdc-icon-size: 22px;"></ha-icon>`;

                        newCell.setAttribute('style', `color: ${theItem.color}`);
                    } else if(theItem.value === "↘ ⅎ" || theItem.value === "↗ ⅎ" || theItem.value === "→ ⅎ"){
                        let tooltip = "Running Normally";
                        additionalArrow = `<ha-icon icon="mdi:home-lightning-bolt" title="${tooltip}" style="--mdc-icon-size: 22px;"></ha-icon>`;
                        newCell.setAttribute('style', `color: ${theItem.color}`);
                    } else if(stateText === "Discharge" || stateText === "Export"){
                            
                            // use force discharge icon
                            let tooltip = "Planned Export";
                            additionalArrow = `<ha-icon icon="mdi:battery-minus" style="" title="${tooltip}" class="icons" style="--mdc-icon-size: 22px;"></ha-icon>`;
                            
                    } else if(stateText === "FreezeDis" || stateText === "FreezeChrg" || stateText === "HoldChrg" || stateText === "NoCharge" || stateText === "FreezeExp"){
                            // use force discharge icon
                            additionalArrow = '<ha-icon icon="mdi:battery-lock" style="" title="Charging Paused"></ha-icon>';
                            newCell.setAttribute('style', `color: ${theItem.color}`);
                    } else if(stateText === "Charge" || stateText === "Alert Charge"){
                        let tooltip = "Planned Charge";
                        additionalArrow = `<ha-icon icon="mdi:battery-charging-100" title="${tooltip}" style="--mdc-icon-size: 22px;"></ha-icon>`;
                        
                        newCell.setAttribute('style', 'color: var(--energy-battery-in-color)');                    
                    }
                    
                    let directionalArrow = this.replaceArrowsWithIcons(theItem.value);
                    cellResponseArray.push(`${weatherAlert}${additionalArrow}${directionalArrow[1]}${snail}`);                         

                    if(isBothField){
                    
                        const arrowsToReturn = ["↗", "↘"];
                        let arrowArray = [];
                        for (const arrow of arrowsToReturn) {
                            const iconString = this.replaceArrowsWithIcons(arrow)[1];
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = iconString;
                            
                            const iconElement = tempDiv.firstElementChild; // the <ha-icon> element
                            
                            if(arrow === "↗")
                                iconElement.style.color = 'var(--energy-battery-in-color)';
                            if(arrow === "↘")
                                iconElement.style.color = 'var(--energy-battery-out-color)';
                            
                            iconElement.style.margin = '0 -4px';
                                
                            arrowArray.push(iconElement);
                        }  
                        
                        if(stateText === "Both"){
                            cellResponseArray.length = 0;

                            cellResponseArray.push('<ha-icon icon="mdi:battery-charging-100" style="color: var(--energy-battery-in-color); --mdc-icon-size: 22px;" title="Planned Charge" class="icons"></ha-icon>');
                            cellResponseArray.push(arrowArray[0].outerHTML);
                            cellResponseArray.push('<ha-icon icon="mdi:battery-minus" style="color: var(--energy-battery-out-color);" title="Planned Export" class="icons"></ha-icon>');
                            cellResponseArray.push(arrowArray[1].outerHTML);
                        } else if(stateText === "Both-Idle" || stateText === "Both-Chg" || stateText === "Both-Dis" || stateText === "Both-Dis-Snail"){
                            let houseColor = "#000000";
                            if(this.getLightMode(darkMode))
                                houseColor = "#FFFFFF";

                            cellResponseArray.length = 0;
                            cellResponseArray.push(`<ha-icon icon="mdi:home-lightning-bolt" style="color: ${houseColor}" title="Idle" style="--mdc-icon-size: 22px;"></ha-icon>`);
                            let arrowColourOverride = arrowArray[1].cloneNode(true);
                            arrowColourOverride.style.color = houseColor;
                            cellResponseArray.push(arrowColourOverride.outerHTML);
                            cellResponseArray.push(`<ha-icon icon="mdi:battery-minus" style="color: var(--energy-battery-out-color);" title="Planned Export" class="icons"></ha-icon>`);
                            cellResponseArray.push(arrowArray[1].outerHTML);
                            if(stateText === "Both-Dis-Snail")
                                cellResponseArray.push(`<ha-icon icon="mdi:snail" title="Low Power Mode" style="--mdc-icon-size: 18px;"></ha-icon>`);
                        }
                    
                    }
                }
            }
            
            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            
            // PV Column pv-column            
            
            if(column === 'pv-column'){
                //newCell.style.backgroundColor = theItem.color;
                
                if((theItem.value.includes("☀") || theItem.value.length > 0) && !theItem.value.includes("⚊")) {
                    
                    if(hasDebug && useDebug)
                        newContent = rawValue + " (" + debugValue + ")";
                    else
                        newContent = rawValue;
                    
                    
                    let additionalIcon = "";
                    if(!this.isSmallScreen())
                        additionalIcon = '<ha-icon icon="mdi:white-balance-sunny" style="margin: 0; --mdc-icon-size: 16px; display: flex; align-items: center; justify-content: center;"></ha-icon>';
                    
                    cellResponseArray.push(`<div class="iconContainer">${additionalIcon} <div style="margin: 0 4px;">${newContent}</div></div>`);                
                }
            }
            
            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            
            // Limit Column limit-column
            
            if(column === "limit-column" && !useOldSkool){
                
                if(theItem.value.replace(/\s/g, '').length > 0){
                    
                    let debugSVG = ``;
                    let debugString = theItem.value;
                    if (hasDebug) {
                        
                        if(useDebug){
                            if(rawValue != debugValue){
                                debugSVG = `<svg version="1.1" width="26" height="26" id="limitSVG">
                                    <circle cx="13" cy="13" r="11" stroke="#2a3240" stroke-width="1" stroke-dasharray="5,3" fill="#e1e1e1"/>
                                    <text class="pill" x="13" y="14" dominant-baseline="middle" text-anchor="middle" fill="#2a3240" font-size="10">${debugValue}</text>
                                    </svg>`;
                            }
                        }
                        debugString = rawValue;
                    }
                    
                    const mainSVG = `<svg version="1.1" width="26" height="26" id="limitSVG">
                            <circle cx="13" cy="13" r="11" stroke="#2a3240" stroke-width="2" fill="#e1e1e1"/>
                            <text class="pill" x="13" y="14" dominant-baseline="middle" text-anchor="middle" fill="#2a3240" font-size="10" font-weight="bold">${debugString}</text>
                            </svg>`;
        
                    cellResponseArray.push(`<div class="iconContainer">${mainSVG} ${debugSVG}</div>`);
                
                }
            } else if(column === "limit-column" && useOldSkool){
                cellResponseArray.push(theItem.value);
            }
            
            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            
            // SOC Column soc-column
            
            if(column === "soc-column"){
                
                let arrowForLabel = this.replaceArrowsWithIcons(theItem.value);
    
                let batteryPercent = rawValue;
                let batteryArrow = "";
                
                if(theItem.value.includes("↘")) {
                    // include a down arrow
                    newCell.style.paddingRight = "0px";
                    batteryArrow = '<ha-icon icon="mdi:arrow-down-thin" style="--mdc-icon-size: 16px; margin: 0 -5px 0 -5px;"></ha-icon>';
                } else if (theItem.value.includes("↗")) {
                    // include a down arrow
                    newCell.style.paddingRight = "0px";
                    batteryArrow = '<ha-icon icon="mdi:arrow-up-thin" style="--mdc-icon-size: 16px; margin: 0 -5px 0 -5px;"></ha-icon>';
                } else {
                    batteryArrow = '<ha-icon icon="mdi:arrow-right-thin" style="--mdc-icon-size: 16px; margin: 0 -5px 0 -5px;"></ha-icon>';
                }
                
                let battery;
                let columnContent = batteryPercent + "%";

                //calculate % in kWh if battery_capacity is present
                
                if(this.config.battery_capacity && !isNaN(parseFloat(this.config.battery_capacity))){
                
                    let capacity = parseFloat(this.config.battery_capacity);
                    let actualCapacity = ((batteryPercent / 100) * capacity).toFixed(2);
                    columnContent = actualCapacity;
                }
                
                const roundedPercent = Math.round(parseInt(batteryPercent, 10) / 10) * 10;
                let batteryIcon;
                if(roundedPercent === 100){
                    batteryIcon = "battery";
                }
                else if (roundedPercent < 5){
                    batteryIcon = `battery-outline`;
                } else {
                    batteryIcon = `battery-${roundedPercent}`;
                }
    
                battery = `<ha-icon icon="mdi:${batteryIcon}" style="--mdc-icon-size: 20px;" title="${batteryPercent}%"></ha-icon>${batteryArrow}`;
                
                newCell.style.paddingLeft = "4px";
                newCell.style.minWidth = "70px";
                newCell.style.alignItems = "center";
                
                if(useOldSkool)
                    cellResponseArray.push(`<div title="${batteryPercent}%">${columnContent}${arrowForLabel[1]}</div>`);
                else 
                    cellResponseArray.push(`<div style="width: 70px; align-items: center; display: flex; justify-content: center; margin: 0 auto;"><div class="iconContainerSOC" title="${batteryPercent}%">${battery}</div><div style="margin-left: 5px; margin-top: 2px;">${columnContent}</div></div>`);                
                             
            }
            
            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            
            // Setting appropriate cell color for weather columns
            
            if(column === "weather-column" || column === "temp-column" || column === "rain-column"){
                if(theItem.color == "#FFFFFF")
                    newCell.style.color = "var(--primary-text-color)";
                else 
                    newCell.style.color = theItem.color;
                    
                if (darkMode && useOldSkool)
                    newCell.style.color = "#000000";
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            
            // Weather Column weather-column            
            
            if(column === "weather-column") {
                
                if(theItem.value !== undefined && theItem.value !== null){
                   
                    let condition = theItem.value.condition;
                    if(condition === "partlycloudynight")
                        condition = "partlycloudy";
                    const lang = this._hass.language;
                    const key = `component.weather.entity_component._.state.${condition}`;
                    
                    const readableCondition = this._hass.resources[lang]?.[key] || condition;            
                    
                    let weatherIcon = this.convertConditionToIcon(theItem.value.condition);
                    //const readableCondition = this._hass.localize(`component.weather.state._.${theItem.value.condition}`);
                    
                    const weatherEntity = this._hass.states[this.config.weather_entity];
                    const tempUnit = weatherEntity?.attributes?.temperature_unit || this._hass.config.unit_system.temperature;
        
                    cellResponseArray.push(`<div class="iconContainer"><ha-icon icon="mdi:${weatherIcon}" title="${readableCondition}, ${theItem.value.temperature}${tempUnit}"></ha-icon></div>`);
                }
            }
            
            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            
            // Temperature Column temp-column                   
            
            if(column === "temp-column") {
                
                if(theItem.value !== undefined && theItem.value !== null){
                    
                    const temp = parseFloat(theItem.value.temperature);
                    const weatherEntity = this._hass.states[this.config.weather_entity];
                    const tempUnit = weatherEntity?.attributes?.temperature_unit || this._hass.config.unit_system.temperature;
        
                    cellResponseArray.push(`<div class="iconContainer">${temp.toFixed(1)}<div class="tempUnit">${tempUnit}</div></div>`);
                }
            } 
            
            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            
            // Rain Column rain-column                   
            
            if(column === "rain-column") {
                
                if(theItem.value !== undefined && theItem.value !== null){
                    
                    const rainChance = Math.round(parseFloat(theItem.value.precipitation_probability));
                    cellResponseArray.push(`<div class="iconContainer">${rainChance}%</div>`);
                }
            }             
            
        }
        
        // finally replace any empty cell or "⚊" with iconography
        
        if (typeof theItem?.value === 'string' && (this.config.fill_empty_cells ?? true) && (newContent.length === 0 || newContent ==="⚊") && !isNonDataColumn){

            let minusColor = "var(--primary-text-color)";
            if(theItem.color && useOldSkool)
                minusColor = "black";
                
            newContent = "";
            
            cellResponseArray.length = 0;    
            cellResponseArray.push(`<div class="iconContainer"><ha-icon icon="mdi:minus" style="color: ${minusColor}; margin: 0 2px; opacity: 0.25;"></ha-icon></div>`);
        }
        
        // For all other cells that dont need custom transform
        if(!columnsWithCustomTransformation.includes(column) && cellResponseArray.length === 0){
            
            if(hasDebug && useDebug)
                newContent = rawValue + " (" + debugValue + ")";
            else 
                newContent = rawValue;
            
            if(newContent !== undefined && newContent.length > 0 )
                cellResponseArray.push(newContent);
        }        

        // 
        
        if(!isNonDataColumn && typeof theItem.value === 'string')
            if(theItem.value.includes("ⅎ"))
                cellResponseArray.push(` <ha-icon icon="mdi:hand-back-right-outline" title="OVERRIDE" style="--mdc-icon-size: 18px;"></ha-icon>`); 
        
        for (const object of cellResponseArray) {
          newCell.innerHTML += object;
        }

        return newCell;
      
  }
  
  getCellTransformation(theItem, column, darkMode, itemIndex, timestamp) {
      
    let newCell = document.createElement('td');
    let newContent = "";
    
    const timeForSelectOverride = this.getTimeframeForOverride(timestamp.value);
    const forceEntityObjects = this.getOverrideEntities();    
    const isAllowed = this.checkRowIsAllowedForOverride(forceEntityObjects, timeForSelectOverride, itemIndex);    
    
    //newCell.setAttribute('onclick', 'console.log("hello")');
    
    //override fill empty cells
    let fillEmptyCells;
    if(this.config.fill_empty_cells === undefined)
        fillEmptyCells = true;
    else 
        fillEmptyCells = this.config.fill_empty_cells;
      
    //  
    //Set the table up for people that like the Trefor style
    //
    
    if(column === "options-popup-column" || column === "options-column"){
        
        // check if its allowed for the override to be set on the row.
        
        if(column === "options-popup-column") {
            
            const iconSize = 24;
            const iconOpacity = isAllowed ? '0.8' : '0.25';
            const iconPointer = isAllowed ? 'pointer' : 'not-allowed';
            
            // CREATE THE ICON
            const iconEl = document.createElement('ha-icon');
            iconEl.setAttribute('title', "Battery Overrides");
            iconEl.setAttribute('icon', "mdi:application-edit-outline");
            iconEl.style.cursor = iconPointer;
            iconEl.style.opacity = iconOpacity;
            iconEl.style.fill = "var(--text-primary-color)";
            iconEl.style.setProperty('--mdc-icon-size', iconSize + 'px');
            
            for (const forceEntity of forceEntityObjects) {
                const settings = this.getArrayForEntityForceStates(this._hass.states[forceEntity.entityName]);
                const isActive = settings.includes(timeForSelectOverride);
                if(isActive && isAllowed){
                    iconEl.style.color = "rgb(58, 238, 133)";
                    iconEl.style.opacity = 1.0;
                    break;
                }
            }            
            
            // Add click handler
            iconEl.addEventListener('click', () => {
                this.createPopUpForOverrides(this.getTimeframeForOverride(timestamp.value), timestamp, isAllowed);
            });
            
            newCell.style.height = (iconSize+10) + 'px';
            newCell.appendChild(iconEl);        
        }
        
        if(column === "options-column"){
            
            const headerRow = document.createElement('div');
            headerRow.style.display = 'flex';
            headerRow.style.justifyContent = 'space-between';
            headerRow.style.alignItems = 'flex-start';
            
            for (const forceEntity of forceEntityObjects) {
                // Create Icon
                const icon = this.createButtonForOverrides(forceEntity, timeForSelectOverride, '24', 'var(--primary-text-color)', true, isAllowed, true);
                // Append to DOM
                icon.style.width = '34px';
                headerRow.appendChild(icon);            
            }
            
            newCell.style.width = '170px';
            newCell.appendChild(headerRow);     
    
        }
        
    }
    

    
    if(column === "time-column" && this.config.force_single_line === true)
        newCell.style.whiteSpace = "nowrap";
    
    if(column !== 'import-export-column' && column !== "options-column" && column !== "options-popup-column" && column !== "rain-column" && column !== "temp-column" && column !== "weather-column" && column !== "car-column"){ // weather and car not supported by old skool
        if(this.config.old_skool === true || this.config.old_skool_columns !== undefined){ 
            
            if(this.config.old_skool === true || this.config.old_skool_columns.indexOf(column) >= 0){
            
                //this.config.old_skool_columns.indexOf(column) >= 0
                newContent = theItem.value.replace(/[↘↗→]/g, '');
                newContent = this.adjustStatusFields(newContent);
              
                let additionalArrow = "";
    
                if(theItem.value.includes("↘")) {
                    // include a down arrow
                    additionalArrow = `<ha-icon icon="mdi:arrow-down-thin" style="margin: 0 0 0 -5px; opacity:0.75;"></ha-icon>`;
                    newCell.style.paddingRight = "0px";
                } else if (theItem.value.includes("↗")) {
                    // include a up arrow
                    additionalArrow = `<ha-icon icon="mdi:arrow-up-thin" style="margin: 0 0 0 -5px; opacity:0.75;"></ha-icon>`;   
                    newCell.style.paddingRight = "0px";
                } else if (theItem.value.includes("→")) {
                    additionalArrow = `<ha-icon icon="mdi:arrow-right-thin" style="margin: 0 0 0 -5px; opacity: 0.75;"></ha-icon>`;                 
                    newCell.style.paddingRight = "0px";
                }
                
                if(this.config.old_skool === true) {
                    newCell.style.border = "1px solid white";
                    newCell.style.backgroundColor = "#FFFFFF";
                }
                
                
                //newCell.style.backgroundColor = "#FFFFFF";
                newCell.style.height = "22px";
                
                // set the PV or Load column to use the HTML debug 10% options if in the card YAML
                
                if(column === 'import-column' || column === 'export-column'){
                    
                }
                
                if(column === "pv-column" || column === "load-column" || column === 'import-column' || column === 'export-column' || column === "limit-column"){
    
                    const hasBoldTags = /<b>.*?<\/b>/.test(theItem.value);
                    const hasItalicTags = /<i>.*?<\/i>/.test(theItem.value);
                    let contentWithoutTags = theItem.value.replace(/<b>(.*?)<\/b>/g, '$1');
                    contentWithoutTags = contentWithoutTags.replace(/<i>(.*?)<\/i>/g, '$1');
                    let debugPrices = false;
                    if (theItem.value.includes("(") && theItem.value.includes(")"))
                        debugPrices = true;
                    
                    if(this.config.debug_columns !== undefined) { // there are debug columns in the YAML
                        if(this.config.debug_columns !== undefined && this.config.debug_columns.indexOf(column) > -1){ // the column is a debug column
                        
                            // SHOW THE DEBUG VALUE TOO!
                            newContent = theItem.value.replace(/[ⅎ]/g, '');
                            if(theItem.value.includes("ⅎ"))
                                newContent += ` <ha-icon icon="mdi:hand-back-right-outline" title="FORCED" style="--mdc-icon-size: 18px;"></ha-icon>`;  
                        } else {
                            // we need to remove the debug value from the string
                            if(column === "pv-column" || column === "load-column" || column === "limit-column")
                                if(column === "pv-column" || column === "load-column")
                                    newContent = parseFloat(theItem.value).toFixed(2);
                                else 
                                    newContent = parseFloat(theItem.value).toFixed(0);
                                    
                                if(theItem.value.includes("ⅎ"))
                                    newContent += ` <ha-icon icon="mdi:hand-back-right-outline" title="FORCED" style="--mdc-icon-size: 18px;"></ha-icon>`;  
                            
                            else {
                                if(debugPrices){
                                    let priceStrings = this.getPricesFromPriceString(contentWithoutTags, hasBoldTags, hasItalicTags, debugPrices);
                                    newContent = priceStrings[0];
                                }                            
                            }
                        }
                    } else { // there are NO debug columns in the YAML, so dont show debug values even if HTML Debug is ON
                        if(column === "pv-column" || column === "load-column" || column === "limit-column")
                            if(column === "pv-column" || column === "load-column")
                                newContent = parseFloat(theItem.value).toFixed(2);
                            else 
                                newContent = parseFloat(theItem.value).toFixed(0);
                            if(theItem.value.includes("ⅎ"))
                                newContent += ` <ha-icon icon="mdi:hand-back-right-outline" title="FORCED" style="--mdc-icon-size: 18px;"></ha-icon>`;                                  
                        else {
                            if(debugPrices){
                                let priceStrings = this.getPricesFromPriceString(contentWithoutTags, hasBoldTags, hasItalicTags, debugPrices);
                                newContent = priceStrings[0];
                            }
                        }
                            
                    }
                }   
                
                
                if((theItem.value === "Both" || theItem.value === "Both-Idle" || theItem.value === "Both-Chg" || theItem.value === "Both-Dis" || theItem.value === "Both-Dis-Snail") && column === "state-column"){
                    
                    newCell.style.minWidth = "186px";
                    if(this.config.use_friendly_states === true)
                        newCell.style.minWidth = "276px";
                    newCell.style.paddingLeft = "0px";
                    newCell.style.paddingRight = "0px";
                    
                    let chargeString = "Charge";
                    if(theItem.value === "Both-Chg" || theItem.value === "Both-Dis" || theItem.value === "Both-Idle" || theItem.value === "Both-Dis-Snail")
                        chargeString = "";
                    
                    let dischargeString = "Export";
                    
                    //console.log("1: " + dischargeString);
                    
                    if(this.isSmallScreen() && (this.config.use_friendly_states === false || this.config.use_friendly_states === undefined)){
                        
                        if(theItem.value === "Both") {
                            chargeString = "Chg";
                            dischargeString = "Exp";
                        }
                        
                        if(theItem.value === "Both-Chg" || theItem.value === "Both-Dis" || theItem.value === "Both-Idle" || theItem.value === "Both-Dis-Snail") {
                            dischargeString = "Exp";                        
                        }
                        
                        newCell.style.minWidth = "110px";
                    }
                    
                    //console.log("2: " + dischargeString);
                    
                    
                    if(this.config.use_friendly_states === true && this.isSmallScreen() === false){
                        if(theItem.value === "Both")
                            chargeString = "Planned Charge";
                        else if(theItem.value === "Both-Chg")
                            chargeString = "Charging";
                        else if(theItem.value === "Both-Dis")
                            chargeString = "Discharging";
                            
                        dischargeString = "Planned Export";                    
                    } else if(this.config.use_friendly_states === true && this.isSmallScreen() === true){
                        if(theItem.value === "Both")
                            chargeString = "Plnd Chg";
                        else if(theItem.value === "Both-Chg")
                            chargeString = "Chg";    
                        else if(theItem.value === "Both-Dis" || theItem.value === "Both-Dis-Snail")
                            chargeString = "Dis"; 
                            
                        dischargeString = "Plnd Dis"; 
                        newCell.style.minWidth = "110px";
                    }
                    
                    //console.log("3: " + dischargeString);
                    
                    let chargeBackgroundColor = "background-color:#3AEE85;";
                    let chargeTextColor = "color: #000000;";
                    if(theItem.value === "Both-Idle" || theItem.value === "Both-Dis" || theItem.value === "Both-Chg" || theItem.value === "Both-Dis-Snail"){
                        chargeBackgroundColor = "";
                        chargeTextColor = "";
                    }
                    let chargeIcon;
                    if(theItem.value === "Both" || theItem.value === "Both-Chg")
                        chargeIcon = '<ha-icon icon="mdi:arrow-up-thin" style="margin: 0 0 0 -5px"></ha-icon>';
                    else if(theItem.value === "Both-Idle")
                        chargeIcon = '<ha-icon icon="mdi:arrow-right-thin" style="margin: 0 0 0 -3px"></ha-icon>';
                    else if(theItem.value === "Both-Dis" || theItem.value === "Both-Dis-Snail")
                        chargeIcon = '<ha-icon icon="mdi:arrow-down-thin" style="margin: 0 0 0 -5px"></ha-icon>';
                    
                    let snail = ``;
                    if(theItem.value === "Both-Dis-Snail")
                        snail = `<ha-icon icon="mdi:snail" title="Low Power Mode" style="--mdc-icon-size: 14px;"></ha-icon>`;
                     
                        
                    newCell.innerHTML = `<div style="width: 100%; height: 100%;" id="${theItem.value}">
                    <div style='${chargeBackgroundColor} width: 50%; height: 100%; float: left; display: flex; align-items: center; justify-content: center; ${chargeTextColor}'>${chargeString}${chargeIcon}</div>
                    <div style='background-color:#FFFF00; width: 50%; height: 100%; float: left; display: flex; align-items: center; justify-content: center; color: #000000;'>${dischargeString}<ha-icon icon="mdi:arrow-down-thin" style="margin: 0 0 0 -5px"></ha-icon>${snail}</div>
                    </div>`;
                
                } else if(column === "import-export-column"){
                    
                    theItem.forEach((item, index) => {
                        newContent += `<div style="display: flex; align-items: center; justify-content: center; height: 50%; background-color: ${item.color}">${item.value}</div>`;
                    });
                    
                    newCell.innerHTML = newContent;
                    
                } else if(column === "pv-column") {
                    
                    newCell.style.backgroundColor = theItem.color;
                    
                    if((theItem.value.includes("☀") || theItem.value.length > 0) && !theItem.value.includes("⚊")) {
                        
                        if (theItem.value.length > 0 && !theItem.value.includes("☀"))
                            newCell.style.backgroundColor = "#FFFFFF";
                        
                        //console.log("PV Data: " + theItem.value);
                        newContent = newContent.replace(/[☀]/g, '');
                        
                        if(!newContent.includes("(") && !newContent.includes(")"))
                            newContent = parseFloat(newContent).toFixed(2);
                        
                        
                        let additionalIcon = "";
                        if(!this.isSmallScreen())
                            additionalIcon = '<ha-icon icon="mdi:white-balance-sunny" style="margin: 0; opacity: 0.5; --mdc-icon-size: 16px; display: flex; align-items: center; justify-content: center;"></ha-icon>';
                        
                        newCell.innerHTML = `<div class="iconContainer">${additionalIcon} <div style="margin: 0 4px;">${newContent}</div></div>`;
                    } else {
                    if(fillEmptyCells)
                            newCell.innerHTML = `<div class="iconContainer"><ha-icon icon="mdi:minus" style="margin: 0 2px; opacity: 0.25;"></ha-icon></div>`;
                        
                    }
                } else {
                    
                    let snail = ``;
                    if(newContent.includes("🐌")){
                        newContent = newContent.replace('Exp🐌', 'Export');
                        snail = `<ha-icon icon="mdi:snail" title="Low Power Mode" style="--mdc-icon-size: 14px;"></ha-icon>`;
                    }
                    
                    let weatherAlert = ``;
                    if(newContent.includes("⚠"))
                        weatherAlert = `<ha-icon icon="mdi:alert-outline" title="Weather Alert" style="--mdc-icon-size: 18px;"></ha-icon>`;
                    
                   
                   let friendlyText = "";
                   if(column === "state-column") {
                    
                        friendlyText = newContent;
                        
                        friendlyText = friendlyText.replace('Force Dischrg', 'Discharge');
                        friendlyText = friendlyText.replace('Force Charge', 'Charge');
                        //friendlyText = friendlyText.replace('Exp🐌', 'Export');
                        
                        
                        if(theItem.value.includes("ⅎ")){
                            friendlyText = friendlyText.replace('Exp', 'Export');
                            
                            friendlyText = "Manually Forced " + friendlyText;
                            
                            if(!friendlyText.includes("Charge") && !friendlyText.includes("Discharge") && !friendlyText.includes("Export"))
                                friendlyText = friendlyText + "Demand";
                            friendlyText = friendlyText.replace('ⅎ', '');
                        } else {
                            if(theItem.value === "↘") {
                                friendlyText = "Discharging";
                            } else if (theItem.value === "↗") {
                                friendlyText = "Charging";
                            } else if (theItem.value === "→") {
                                friendlyText = "Idle";
                            }
                            
                            friendlyText = friendlyText.replace('FreezeDis', 'Charging Paused');
                            friendlyText = friendlyText.replace('FreezeExp', 'Charging Paused');
                            friendlyText = friendlyText.replace('FreezeChrg', 'Maintaining SOC'); //FreezeChrg
                            friendlyText = friendlyText.replace('HoldChrg', 'Maintaining SOC'); //HoldChrg
                            friendlyText = friendlyText.includes("NoCharge") ? friendlyText.replace('NoCharge','Charge to "limit"') : friendlyText.replace('Charge', 'Planned Charge');
                            friendlyText = friendlyText.replace('Discharge', 'Planned Export'); //Discharge
                            friendlyText = friendlyText.replace('Export', 'Planned Export'); //Discharge
                            friendlyText = friendlyText.replace('Alert Charge', 'Planned Charge ⚠'); // Alert Charge
                        }
                        
                        if(this.config.use_friendly_states === true){
                            newContent = friendlyText;
                        }
                   }
                    
                    newCell.style.backgroundColor = theItem.color;
                    
                    if(theItem.value.replace(/\s/g, '').length === 0 || theItem.value === "0" || theItem.value === "⚊") {
                        
                        if(fillEmptyCells)
                            newCell.innerHTML = `<div class="iconContainer"><ha-icon icon="mdi:minus" style="margin: 0 2px; opacity: 0.25;"></ha-icon></div>`;
                    } else {
                        if(column === "cost-column"){
                            newContent = newContent.replace(' ', '');
                            newContent = newContent.trim();                        
                        }
                        if(column === "total-column")
                            newContent = this.adjustTotalCostField(newContent); 
    /*                    if(column === "load-column"){
                            newContent = parseFloat(newContent).toFixed(2);
                        }
                            */
                        newCell.innerHTML = `<div class="iconContainer" title="${friendlyText}"><div style="margin: 0 2px;">${weatherAlert}${newContent}</div>${additionalArrow}${snail}</div>`;
                    }
                }
                
                // if user uses old_skool: true AND old_skool_columns on dark mode then this will not work, they need to turn off old_skool
                if(this.config.old_skool_columns !== undefined && this.config.old_skool_columns.indexOf(column) >= 0 && darkMode){
                    if(theItem.value.includes("ⅎ"))
                        newCell.style.backgroundColor = "white";
                    newCell.style.color = "black";
                    if(newCell.style.backgroundColor.length === 0)
                        newCell.style.color = "white";
                } else {
                    newCell.style.color = "#000000";
                }
            
                return newCell;
            }
        }    
    }
        
    if(column !== "import-export-column" && column !== "weather-column" && column !== "temp-column" && column !== "rain-column" && column !== "options-column" && column !== "options-popup-column"){
        newCell.style.color = theItem.color;
        if(theItem.value.replace(/\s/g, '').length === 0 || theItem.value === "0" || theItem.value === "⚊") {
            if(fillEmptyCells)
                newCell.innerHTML = `<div class="iconContainer"><ha-icon icon="mdi:minus" style="margin: 0 2px; opacity: 0.25;"></ha-icon></div>`;
        } else {
            
            if(column === "car-column") {
                newCell.style.color = "var(--primary-text-color)";
                let additionalIcon = "";
                
                if(this.config.car_charge_switch){
                    const entity = this._hass.states[this.config.car_charge_switch];
                    if (entity && entity.state === 'on' && itemIndex === 0) {
                        additionalIcon = '<ha-icon class="pulse-icon" icon="mdi:ev-plug-type2" style="--mdc-icon-size: 16px; margin-top: -2px; margin-left: 2px;"></ha-icon>';
                    }
                }
                
                newCell.innerHTML = `<div class="iconContainer">${theItem.value}${additionalIcon}</div>`;
            
            } else {
                newCell.innerHTML = `<div class="iconContainer">${theItem.value}</div>`;
            }
        }
    }
    
    if(column === "weather-column" || column === "temp-column" || column === "rain-column"){
        if(theItem.color === "#FFFFFF")
            newCell.style.color = "var(--primary-text-color)";
        else
            newCell.style.color = theItem.color;
    }
    
    if(column === "weather-column") {

        if(theItem.value !== undefined && theItem.value !== null){
           
            let condition = theItem.value.condition;
            if(condition === "partlycloudynight")
                condition = "partlycloudy";
            const lang = this._hass.language;
            const key = `component.weather.entity_component._.state.${condition}`;
            
            const readableCondition = this._hass.resources[lang]?.[key] || condition;            
            
            let weatherIcon = this.convertConditionToIcon(theItem.value.condition);
            //const readableCondition = this._hass.localize(`component.weather.state._.${theItem.value.condition}`);
            
            const weatherEntity = this._hass.states[this.config.weather_entity];
            const tempUnit = weatherEntity?.attributes?.temperature_unit || this._hass.config.unit_system.temperature;

            newCell.innerHTML = `<div class="iconContainer"><ha-icon icon="mdi:${weatherIcon}" title="${readableCondition}, ${theItem.value.temperature}${tempUnit}"></ha-icon></div>`;
        }
    }
    
    if(column === "temp-column") {

        if(theItem.value !== undefined && theItem.value !== null){
            
            const roundedTemp = Math.round(parseFloat(theItem.value.temperature));
            const weatherEntity = this._hass.states[this.config.weather_entity];
            const tempUnit = weatherEntity?.attributes?.temperature_unit || this._hass.config.unit_system.temperature;

            newCell.innerHTML = `<div class="iconContainer">${roundedTemp}<div class="tempUnit">${tempUnit}</div></div>`;
        }
    } 
    
    if(column === "rain-column") {
        
        if(theItem.value !== undefined && theItem.value !== null){
            
            const rainChance = Math.round(parseFloat(theItem.value.precipitation_probability));
            newCell.innerHTML = `<div class="iconContainer">${rainChance}%</div>`;
        }
    }        

    if(column === "load-column" || column === "pv-column") {
        
            // set the PV or Load column to use the HTML debug 10% options if in the card YAML
            newContent = theItem.value;

            //check for HTML Debug values
            if(newContent.includes("(") && newContent.includes(")")){
                let content = theItem.value.replace(/[↘↗→ⅎ🐌⚠]/g, '').trim();
                const match = content.match(/(\d+(?:\.\d+)?)\s*\((\d+(?:\.\d+)?)\)/);
                let newVals = parseFloat(match[1]).toFixed(2) + " (" + parseFloat(match[2]).toFixed(2) + ")";
                newContent = newVals;
            }
            
            if(this.config.debug_columns !== undefined) {// there are debug columns in the YAML
                if(this.config.debug_columns.indexOf(column) < 0)
                    newContent = parseFloat(newContent).toFixed(2);
            } else {
                newContent = parseFloat(newContent).toFixed(2);
            }
                    
            let additionalIcon = "";
            if(column === "pv-column"){
                if((theItem.value.includes("☀") || theItem.value.length > 0)  && !theItem.value.includes("⚊")) {
                    newContent = newContent.replace(/[☀]/g, '');
                
                    if(!this.isSmallScreen())
                        additionalIcon = '<ha-icon icon="mdi:white-balance-sunny" style="margin: 0; --mdc-icon-size: 18px; display: flex; align-items: center; justify-content: center;"></ha-icon>';
                    
                    newCell.innerHTML = `<div class="iconContainer">${additionalIcon} <div style="margin: 0 4px;">${newContent}</div></div>`;
                }
            } else {
                
                if(theItem.value.includes("ⅎ"))
                    newContent += ` <ha-icon icon="mdi:hand-back-right-outline" title="FORCED" style="--mdc-icon-size: 18px;"></ha-icon>`;                  
                
                newCell.innerHTML = `<div class="iconContainer">${newContent}</div>`;
            }

    } else if(column === "time-column" || column === "total-column"){
          
        newCell.style.color = theItem.color;
        newCell.style.textShadow = "none";
        if(column === "time-column")
            newCell.style.width = "70px";
        
        let content = theItem.value;
        if(column === "total-column")
            content = this.adjustTotalCostField(content); 
        
        newCell.innerHTML = `<div class="iconContainer">${content}</div>`;
        
    } else if(column === "soc-column" || column === "cost-column"){

        newContent = theItem.value.replace(/[↘↗→]/g, '');
        newContent = newContent.replace(' ', '');
        newContent = newContent.trim();
        let batteryPercent = newContent;
          
        let additionalArrow = "";
        let batteryArrow = "";
        
        if(theItem.value.includes("↘")) {
            // include a down arrow
            additionalArrow = '<ha-icon icon="mdi:arrow-down-thin" style="margin: 0 0 0 -5px;"></ha-icon>';
            newCell.style.paddingRight = "0px";
            batteryArrow = '<ha-icon icon="mdi:arrow-down-thin" style="--mdc-icon-size: 16px; margin: 0 -5px 0 -5px;"></ha-icon>';
        } else if (theItem.value.includes("↗")) {
            // include a down arrow
            additionalArrow = '<ha-icon icon="mdi:arrow-up-thin" style="margin: 0 0 0 -5px;"></ha-icon>';                    
            newCell.style.paddingRight = "0px";
            batteryArrow = '<ha-icon icon="mdi:arrow-up-thin" style="--mdc-icon-size: 16px; margin: 0 -5px 0 -5px;"></ha-icon>';
        } else {
            batteryArrow = '<ha-icon icon="mdi:arrow-right-thin" style="--mdc-icon-size: 16px; margin: 0 -5px 0 -5px;"></ha-icon>';
            if(fillEmptyCells && column === "cost-column")
                additionalArrow = '<ha-icon icon="mdi:minus" style="margin: 0 0 0 -5px; opacity: 0.25;"></ha-icon>';                 
        }
        let battery;
        
        if(column === "soc-column") {
            newContent += "%";
            
            //calculate % in kWh if battery_capacity is present
            
            if(this.config.battery_capacity && !isNaN(parseFloat(this.config.battery_capacity))){
            
                let capacity = parseFloat(this.config.battery_capacity);
                let actualCapacity = ((batteryPercent / 100) * capacity).toFixed(2);
                newContent = actualCapacity;
            }
            
            const roundedPercent = Math.round(parseInt(batteryPercent, 10) / 10) * 10;
            let batteryIcon;
            if(roundedPercent === 100){
                batteryIcon = "battery";
            }
            else if (roundedPercent < 5){
                batteryIcon = `battery-outline`;
            } else {
                batteryIcon = `battery-${roundedPercent}`;
            }

            battery = `<ha-icon icon="mdi:${batteryIcon}" style="--mdc-icon-size: 20px;"></ha-icon>${batteryArrow}`;
            
            //newCell.style.display = "flex";
            newCell.style.paddingLeft = "4px";
            
            newCell.style.minWidth = "70px";
            
            newCell.style.alignItems = "center";
            
            newCell.innerHTML = `<div style="width: 70px; align-items: center; display: flex; justify-content: center; margin: 0 auto;"><div class="iconContainerSOC">${battery}</div><div style="margin-left: 5px; margin-top: 2px;">${newContent}</div></div>`;                
        } else {
            newCell.innerHTML = `<div class="iconContainer"><div style="margin: 0 1px;">${newContent}</div>${additionalArrow}</div>`;
        }

    } else if(column === "net-power-column"){

            let additionalArrow = "";
            newContent = theItem.value;
            if(theItem.value < 0){
                //exporting
                //additionalArrow = '<ha-icon icon="mdi:home-export-outline" style="margin: 0 0 0 0; --mdc-icon-size: 18px;"></ha-icon>';
                //newCell.style.paddingRight = "0px";                
            } else {
             //   additionalArrow = '<ha-icon icon="mdi:home-battery-outline" style="margin: 0 0 0 0; --mdc-icon-size: 18px;"></ha-icon>';
             //   newCell.style.paddingRight = "0px";                  
            }

          newCell.innerHTML = `<div class="iconContainer"><div style="margin: 0 1px;">${newContent}</div>${additionalArrow}</div>`;
      
    } else if(column === "state-column"){

        let snail = ``;
        if(theItem.value.includes("🐌")){
            snail = `<ha-icon icon="mdi:snail" title="Low Power Mode" style="--mdc-icon-size: 18px;"></ha-icon>`;
        }
            
        newContent = theItem.value.replace(/[↘↗→ⅎ🐌⚠]/g, '').trim();
        
        let weatherAlert = ``;
        if(theItem.value.includes("⚠"))
            weatherAlert = `<ha-icon icon="mdi:alert-outline" title="Weather Alert" style="--mdc-icon-size: 18px;"></ha-icon>`;
        
          newContent = this.adjustStatusFields(newContent);
            
            let additionalArrow = "";
            newCell.setAttribute('style', 'color: var(--energy-battery-out-color)');
    
                if(theItem.value === "↘" || theItem.value === "↗" || theItem.value === "→"){
                    let tooltip = "Running Normally";
                    if(theItem.value.includes("ⅎ"))
                        tooltip = "Manually Forced Idle";
                        
                    additionalArrow = `<ha-icon icon="mdi:home-lightning-bolt" title=${tooltip} style="--mdc-icon-size: 22px;"></ha-icon>`;
                    if(theItem.value.includes("ⅎ"))
                        additionalArrow += `<ha-icon icon="mdi:hand-back-right-outline" title="${tooltip}" style="--mdc-icon-size: 22px;"></ha-icon>`;
                        
                    newCell.setAttribute('style', `color: ${theItem.color}`);
                } else if(theItem.value === "↘ ⅎ" || theItem.value === "↗ ⅎ" || theItem.value === "→ ⅎ"){
                    let tooltip = "Manually Forced Idle";
                    additionalArrow = `<ha-icon icon="mdi:home-lightning-bolt" title=${tooltip} style="--mdc-icon-size: 22px;"></ha-icon>`;
                    additionalArrow += `<ha-icon icon="mdi:hand-back-right-outline" title="${tooltip}" style="--mdc-icon-size: 22px;"></ha-icon>`;
                    newCell.setAttribute('style', `color: ${theItem.color}`);
                } else if(newContent === "Discharge" || newContent === "Export"){
                        
                        // use force discharge icon
                        let tooltip = "Planned Export";
                        if(theItem.value.includes("ⅎ"))
                            tooltip = "Manual Forced Discharge";                        

                        additionalArrow = `<ha-icon icon="mdi:battery-minus" style="" title="${tooltip}" class="icons" style="--mdc-icon-size: 22px;"></ha-icon>`;
                        if(theItem.value.includes("ⅎ"))
                            additionalArrow += `<ha-icon icon="mdi:hand-back-right-outline" title="${tooltip}" style="--mdc-icon-size: 22px;"></ha-icon>`;
                        
                } else if(newContent === "FreezeDis" || newContent === "FreezeChrg" || newContent === "HoldChrg" || newContent === "NoCharge" || newContent === "FreezeExp"){
                        // use force discharge icon
                        additionalArrow = '<ha-icon icon="mdi:battery-lock" style="" title="Charging Paused"></ha-icon>';
                        newCell.setAttribute('style', `color: ${theItem.color}`);
                } else if(newContent === "Charge" || newContent === "Alert Charge"){
                    let tooltip = "Planned Charge";
                    
                    if(theItem.value.includes("ⅎ"))
                        tooltip = "Manual Forced Charge";
                    
                    additionalArrow = `<ha-icon icon="mdi:battery-charging-100" title="${tooltip}" style="--mdc-icon-size: 22px;"></ha-icon>`;
                    //if(theItem.value.includes("⚠"))
                    //    additionalArrow += `<ha-icon icon="mdi:alert-outline" title="${tooltip}" style="--mdc-icon-size: 18px;"></ha-icon>`;
                    if(theItem.value.includes("ⅎ"))
                        additionalArrow += `<ha-icon icon="mdi:hand-back-right-outline" title="${tooltip}" style="--mdc-icon-size: 22px;"></ha-icon>`;
                    newCell.setAttribute('style', 'color: var(--energy-battery-in-color)');                    
                } else if(newContent === "Both"){
                    additionalArrow = '<ha-icon icon="mdi:battery-charging-100" style="color: var(--energy-battery-in-color); --mdc-icon-size: 22px;" title="Planned Charge" class="icons"></ha-icon><ha-icon icon="mdi:battery-minus" style="color: var(--energy-battery-out-color);" title="Planned Export" class="icons"></ha-icon>';
                } else if(newContent === "Both-Idle" || newContent === "Both-Chg" || newContent === "Both-Dis" || newContent === "Both-Dis-Snail"){
                    let houseColor = "#000000";
                    if(this.getLightMode(darkMode))
                        houseColor = "#FFFFFF";
                            
                    this.getLightMode(darkMode)
                    additionalArrow = `<ha-icon icon="mdi:home-lightning-bolt" style="color: ${houseColor}" title="Idle" style="--mdc-icon-size: 22px;"></ha-icon><ha-icon icon="mdi:battery-minus" style="color: var(--energy-battery-out-color);" title="Planned Export" class="icons"></ha-icon>`;
                    if(newContent === "Both-Dis-Snail")
                        additionalArrow += `<ha-icon icon="mdi:snail" title="Low Power Mode" style="--mdc-icon-size: 18px;"></ha-icon>`;
                }
                
          newCell.innerHTML = `<div class="iconContainer">${weatherAlert}${additionalArrow}${snail}</div>`;
          
    } else if(column === "limit-column"){

        if(theItem.value.replace(/\s/g, '').length > 0){
            
            let debugSVG = ``;
            let debugString = theItem.value;
            if (theItem.value.includes("(") || theItem.value.includes(")")) {
                const match = theItem.value.match(/(\d+)\s*\((\d+(?:\.\d+)?)\)/);
                
                // match[1]
                
                if(this.config.debug_columns !== undefined && this.config.debug_columns.indexOf(column) > -1){
                    if(match[1] != match[2]){
                        debugSVG = `<svg version="1.1" width="26" height="26" id="limitSVG">
                            <circle cx="13" cy="13" r="11" stroke="#2a3240" stroke-width="1" stroke-dasharray="5,3" fill="#e1e1e1"/>
                            <text class="pill" x="13" y="14" dominant-baseline="middle" text-anchor="middle" fill="#2a3240" font-size="10">${match[2]}</text>
                            </svg>`;
                    }
                }
                debugString = match[1];
                //console.log('Match: ' + match);
            }
            
            const mainSVG = `<svg version="1.1" width="26" height="26" id="limitSVG">
                    <circle cx="13" cy="13" r="11" stroke="#2a3240" stroke-width="2" fill="#e1e1e1"/>
                    <text class="pill" x="13" y="14" dominant-baseline="middle" text-anchor="middle" fill="#2a3240" font-size="10" font-weight="bold">${debugString}</text>
                    </svg>`;

            newCell.innerHTML = `
            
                <div class="iconContainer">
                    ${mainSVG} ${debugSVG}
                </div>`;
        
        }
        
    } else if (column === "import-column" || column === "export-column") {
        
        // manage debug price pills appropriately
        // debug_prices_only | true | false
        
        if ((theItem.value.includes("(") || theItem.value.includes(")")) && this.config.debug_columns !== undefined && this.config.debug_columns.indexOf(column) > -1) {
            // if debug prices are present based on ( ) search
            // AND YAML config has debug_columns
            // AND YAML config has specific column for debug_columns
            // THEN SHOW THE DEBUG
            
            let newPills = "";
            const hasBoldTags = /<b>.*?<\/b>/.test(theItem.value);
            const hasItalicTags = /<i>.*?<\/i>/.test(theItem.value);
            let contentWithoutTags = theItem.value.replace(/<b>(.*?)<\/b>/g, '$1');
            contentWithoutTags = contentWithoutTags.replace(/<i>(.*?)<\/i>/g, '$1');
            
            // TEST
            //contentWithoutTags = "-1.23? ⚖ (-3.45)";
            
            
            let priceStrings;
            if(this.config.debug_prices_only === true){
                // force debug price pill only
                priceStrings = this.getPricesFromPriceString(contentWithoutTags, hasBoldTags, hasItalicTags, true);
                newCell.innerHTML = '<div class="iconContainer">' + this.getTransformedCostToPill({"value":priceStrings[1], "color":theItem.color}, darkMode) + '</div>';
            
                
            } else {
                priceStrings = this.getPricesFromPriceString(contentWithoutTags, hasBoldTags, hasItalicTags, false);
    
                    if(this.config.stack_pills === false){
                        newCell.innerHTML = '<div class="iconContainer">' + this.getTransformedCostToPill({"value":priceStrings[0], "color":theItem.color}, darkMode) 
                        + this.getTransformedCostToPill({"value":priceStrings[1], "color":theItem.color}, darkMode) 
                        + '</div>';
                    } else {
                        newPills += '<div style="height: 26px; align-items: center;">' + this.getTransformedCostToPill({"value":priceStrings[0], "color":theItem.color}, darkMode) + '</div>';
                        newPills += '<div style="height: 26px; align-items: center;">' + this.getTransformedCostToPill({"value":priceStrings[1], "color":theItem.color}, darkMode) + '</div>';
                        newCell.innerHTML = '<div class="multiPillContainer">' + newPills + '</div>';                        
                    }
            }
            
        } else if(theItem.value.includes("(") || theItem.value.includes(")")){

            const hasBoldTags = /<b>.*?<\/b>/.test(theItem.value);
            const hasItalicTags = /<i>.*?<\/i>/.test(theItem.value);
           let contentWithoutTags = theItem.value.replace(/<b>(.*?)<\/b>/g, '$1');
            contentWithoutTags = contentWithoutTags.replace(/<i>(.*?)<\/i>/g, '$1');
            // TEST
            //contentWithoutTags = "-1.23? ⚖ (-3.45)";
            
           let priceStrings = this.getPricesFromPriceString(contentWithoutTags, hasBoldTags, hasItalicTags, this.config.debug_prices_only);
           
           newCell.innerHTML = '<div class="iconContainer">' + this.getTransformedCostToPill({"value":priceStrings[0], "color":theItem.color}, darkMode) + '</div>';
            
        } else {

            newCell.innerHTML = '<div class="iconContainer">' + this.getTransformedCostToPill(theItem, darkMode) + '</div>';
        }

    } else if(column === "import-export-column"){
        
        let newPills = "";
        let newPillsNoContainer = "";
        theItem.forEach((item, index) => {
            
            const hasBoldTags = /<b>.*?<\/b>/.test(item.value);
            const hasItalicTags = /<i>.*?<\/i>/.test(item.value);
            let contentWithoutTags = item.value.replace(/<b>(.*?)<\/b>/g, '$1');
            contentWithoutTags = contentWithoutTags.replace(/<i>(.*?)<\/i>/g, '$1');
            let priceStrings;
            
            if(this.config.debug_prices_only === true){
                // force debug price pill only
                
                priceStrings = this.getPricesFromPriceString(contentWithoutTags, hasBoldTags, hasItalicTags, true);
                newPills += '<div style="height: 26px; align-items: center;">' + this.getTransformedCostToPill({"value": priceStrings[1], "color": item.color}, darkMode) + '</div>';
                newPillsNoContainer += this.getTransformedCostToPill({"value": priceStrings[1], "color": item.color}, darkMode);

            } else {
                
                let numberOfPrices = theItem.length;
                
                
                newPills += '<div style="height: 26px; align-items: center;">' + this.getTransformedCostToPill(item, darkMode) + '</div>';
                newPillsNoContainer += this.getTransformedCostToPill(item, darkMode);
            }
            
        });
        
        if(this.config.stack_pills === false){
            newCell.innerHTML = '<div class="iconContainer">' + newPillsNoContainer + '</div>';
        } else {
        
            newCell.innerHTML = '<div class="multiPillContainer">' + newPills + '</div>';
            
        }

    }  
    
    // make time column tap/clickable for override pop up
    
    const columnsToReturn = this.config.columns;
    const optionsColumnPresent = (columnsToReturn.includes('options-popup-column') || columnsToReturn.includes('options-column'));
    if(column === "time-column" && !optionsColumnPresent) {
        newCell.style.cursor = 'pointer';
        for (const forceEntity of this.getOverrideEntities()) {
            const settings = this.getArrayForEntityForceStates(this._hass.states[forceEntity.entityName]);
            const isActive = settings.includes(this.getTimeframeForOverride(timestamp.value));
            if(isActive && isAllowed){
                newCell.style.color = "rgb(58, 238, 133)";
                break;
            }
        }         
        newCell.addEventListener('click', () => {
            this.createPopUpForOverrides(this.getTimeframeForOverride(timestamp.value), timestamp, isAllowed);
        });        
    }
    

      return newCell;
  }
  
 
  
  convertConditionToIcon(condition) {
      let icon = "cloud-question";
      if(condition === "partlycloudy")
        icon = "weather-partly-cloudy";
      if(condition === "partlycloudynight")
        icon = "weather-night-partly-cloudy";
      if(condition === "clear-night")
        icon = "weather-night";
      if(condition === "sunny")
        icon = "weather-sunny";
      if(condition === "cloudy")
        icon = "weather-cloudy";
      if(condition === "exceptional")
        icon = "alert-outline";
      if(condition === "fog")
        icon = "weather-fog";
      if(condition === "hail")
        icon = "weather-hail";
      if(condition === "lightning")
        icon = "weather-lightning";
      if(condition === "lightning-rainy")
        icon = "weather-lightning-rainy";
      if(condition === "pouring")
        icon = "weather-pouring";
      if(condition === "snowy")
        icon = "weather-snowy";
      if(condition === "snowy-rainy")
        icon = "weather-snowy-rainy";
      if(condition === "windy")
        icon = "weather-windy";
      if(condition === "windy-variant")
        icon = "weather-windy-variant"; 
      if(condition === "rainy")
        icon = "weather-pouring";
    
        
    return icon;
  }
  
  adjustStatusFields(status){
      
      //console.log(status);
      
    let newState = status;
    if(status === "FrzChrg")
        newState = "FreezeChrg";
    if(status === "HoldChrg")
        newState = "HoldChrg";
    if(status === "NoChrg")
        newState = "NoCharge";
    if(status === "Chrg")
        newState = "Charge";
    if(status === "FrzDis")
        newState = "FreezeDis";
    if(status === "FrzExp")
        newState = "FreezeExp";        
    if(status === "Exp")
        newState = "Export";     
    if(status === "Dis")
        newState = "Discharge";    
    if(status === "Dis ⅎ")
        newState = "Force Dischrg"
    if(status === "Chrg ⅎ")
        newState = "Force Charge"
    if(status === "⚠Chrg")
        newState = "Alert Charge"
    return newState;      
  }
  
  adjustTotalCostField(cost){
      if(cost.includes("-")) {
        cost = cost.replace("-", "");
        cost = "-" + cost;
      }
    return cost;
  }
  
  getPricesFromPriceString(thePriceString, hasBoldTags, hasItalicTags, debugOnly){
      
//            ? ⅆ - Rate that has been modified based on input_number.predbat_metric_future_rate_offset_import or input_number.predbat_metric_future_rate_offset_export
//            ? ⚖ - Rate that has been estimated using future rate estimation data (e.g. Nordpool)
//            = - Rate that has been overridden by the users apps.yaml
//            ± - Rate that has been adjusted with a rate offset in the users apps.yaml
//            $ - Rate that has been adjusted for an Octopus Saving session
//            ? - Rate that has not yet been defined and the previous days data was used instead      
      
            // thePriceString = "-1.23? ⚖ (-3.45)";
      
            const testRegex = /(\d+\.\d+)\D+(\d+\.\d+)/;
            const testMatches = thePriceString.match(testRegex);

            const strippedString = thePriceString.replace(/-/g, '').replace(testMatches[1], '').replace(testMatches[2], '').replace(/[()]/g, '').trim();

            let firstPillString = ""; 
            let secondPillString = "";
            
            //adding back the negative values
            if(thePriceString.includes("-")){
                if((thePriceString.match(/-/g) || []).length == 2){
                    firstPillString = "-";
                    secondPillString = "-";
                } else {
                    if (thePriceString.startsWith("-")) {
                        firstPillString = "-";
                        secondPillString = "";
                    } else {
                        firstPillString = "";
                        secondPillString = "-";
                    }
                }
            }
            
            if(debugOnly){
                firstPillString += testMatches[1];
                secondPillString += testMatches[2] + strippedString;                
            } else {
                firstPillString += testMatches[1] + strippedString;
                secondPillString += testMatches[2];
            }
            
            let firstPart = firstPillString; 
            let secondPart = `(${secondPillString}) `;
            
            if(hasBoldTags){
                firstPart = `<b>${firstPillString}</b>`; 
                secondPart = `<b>(${secondPillString})</b>`;
            }
            
            if(hasItalicTags){
                firstPart = `<i>${firstPillString}</i>`; 
                secondPart = `<i>(${secondPillString})</i>`;
            }
            
            if(hasItalicTags && hasBoldTags){
                firstPart = `<b><i>${firstPillString}</i></b>`; 
                secondPart = `<b><i>(${secondPillString})</i></b>`;
            }
            
            return[firstPart, secondPart];
  }
  
  getTransformedCostToPill(theItem, darkMode){
      
            const hasBoldTags = /<b>.*?<\/b>/.test(theItem.value);
            const hasItalicTags = /<i>.*?<\/i>/.test(theItem.value);
            
            let contentWithoutTags;
            let boldAttribute = "";
            let italicAttribute = "";
            let boldLozenge = "";
            let strokeWidth = 1;
            
            let borderLozengeColor;
                if(this.getLightMode(darkMode) === true)
                    borderLozengeColor= this.getDarkenHexColor(theItem.color, 60);
                else
                    borderLozengeColor= this.getDarkenHexColor(theItem.color, 60);
            
            if (hasBoldTags || hasItalicTags) {
                contentWithoutTags = theItem.value.replace(/<b>(.*?)<\/b>/g, '$1');
                contentWithoutTags = contentWithoutTags.replace(/<i>(.*?)<\/i>/g, '$1');
                
                if(hasBoldTags){
                    boldAttribute = ' font-weight="bold"';
                    strokeWidth = 2;
                    boldLozenge = ' stroke="'+ borderLozengeColor +'" stroke-width="' + strokeWidth + '"';
                } 
                
                if(hasItalicTags){
                    italicAttribute = ' font-style="italic"';
                    strokeWidth = 1;
                    boldLozenge = ' stroke="'+ borderLozengeColor +'" stroke-width="' + strokeWidth + '"';
                }
                
                if(hasItalicTags && hasBoldTags){
                    strokeWidth = 2;
                    boldLozenge = ' stroke="'+ borderLozengeColor +'" stroke-width="' + strokeWidth + '"';
                }
                
            } else {
                strokeWidth = 1;
                contentWithoutTags = theItem.value;
                boldLozenge = ' stroke="'+ borderLozengeColor +'" stroke-width="' + strokeWidth + '"';
            }
            
            // Measure the width of the text in pixels
            
            let textWidth = contentWithoutTags.length * 8.5;// Adjust the factor based on your font and size
            if(textWidth < 70){
                textWidth = 70;
            }
            
            //textWidth = 70;
            
            //console.log("TW: " + textWidth);
            
            let textColor;
            let pillColor = theItem.color;
            if(this.getLightMode(darkMode) === true){
                // card is dark mode
                textColor = this.getDarkenHexColor(theItem.color, 60);
            } else {
                // card is light mode
                //console.log("LIGHT MODE IS ACTIVE");
                textColor = this.getDarkenHexColor(theItem.color, 70);
                pillColor = this.getVibrantColor(theItem.color, 15);
                pillColor = this.getLightenHexColor(pillColor, 10);
            }
                
            let svgLozenge = `<svg version="1.1" width=${textWidth} height="24" style="margin-top: 0px;">
                                <rect x="4" y="2" width="${textWidth-10}" height="20" fill="${pillColor}"${boldLozenge} ry="10" rx="10"/>
                                <text class="pill" x="48%" y="13" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-size="11"${boldAttribute}${italicAttribute}>${contentWithoutTags}</text>
                            </svg>`;
            
            return svgLozenge;
  }
  
  getMetadataFromHTML(html) {
      
      const dummyElement = document.createElement('div');
      dummyElement.innerHTML = html;
      const trElements = dummyElement.querySelectorAll('tbody tr');
      
      let metaArray = [];
      trElements.forEach((trElement, index) => {
          
                const numberOfChildren = trElement.children.length;
                
                //detect if row data is metadata (rows with no table data). If children <td> is less than 2
                if(numberOfChildren < 2){
                    const tdElements = trElement.querySelectorAll('td');
                      tdElements.forEach(tdElement => {
                          metaArray.splice(index, 0, tdElement.innerHTML);
                      });
                    
                }
          
      });
      
      return metaArray;
      
  }
  
getLastUpdatedFromHTML(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();

  // Check if same year, month, day
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  // Format time in 24-hour format
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  // Build final string
  const timeStr = isToday
    ? `Today at ${time}`
    : `${date.toLocaleDateString('en-GB')} at ${time}`;

  return timeStr;
}

  
  isSmallScreen() {
    const screenWidth = window.innerWidth;
    if(screenWidth < 815){
        return true;
    } else {
        return false;
    }
  }
  
isLabelDuringNight(label, hass) {
  const sun = hass.states['sun.sun'];
  if (!sun) return false;

  const sunrise = new Date(sun.attributes.next_rising);
  const sunset = new Date(sun.attributes.next_setting);

  // Extract only the time parts (local time)
  const sunriseHour = sunrise.getHours();
  const sunriseMinute = sunrise.getMinutes();
  const sunsetHour = sunset.getHours();
  const sunsetMinute = sunset.getMinutes();

  // Parse label
  const [labelDayStr, labelTimeStr] = label.split(' ');
  const [labelHour, labelMinute] = labelTimeStr.split(':').map(Number);

  // Compare to assumed sunrise/sunset time
  const labelMinutes = labelHour * 60 + labelMinute;
  const sunriseMinutes = sunriseHour * 60 + sunriseMinute;
  const sunsetMinutes = sunsetHour * 60 + sunsetMinute;

  return labelMinutes < sunriseMinutes || labelMinutes >= sunsetMinutes;
}

findForecastForLabel(label, forecastArray) {
  if (!label || !forecastArray?.length || !this._hass || !this.config?.weather_entity) {
    return null;
  }

  const [labelDayStr, labelTimeStr] = label.split(' ');
  const [labelHour, _labelMinute] = labelTimeStr.split(':').map(Number);

  const weekdayMap = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const targetWeekday = weekdayMap[labelDayStr];
  const now = new Date();
  const todayWeekday = now.getDay();
  const dayOffset = (targetWeekday - todayWeekday + 7) % 7;

  // Create label Date (local time), but round down to the hour
  const labelDate = new Date(now);
  labelDate.setDate(now.getDate() + dayOffset);
  labelDate.setHours(labelHour, 0, 0, 0); // zero minutes/seconds

  const labelHourTime = labelDate.getTime();

  // Try to find forecast that exactly matches this hour (local time)
  for (const forecast of forecastArray) {
    const forecastDate = new Date(forecast.datetime); // UTC -> local
    if (forecastDate.getTime() === labelHourTime) {
      return {
        ...forecast,
        source: 'forecast'
      };
    }
  }

  // If label time is in the past, return the closest future forecast or current weather
  if (labelHourTime < now.getTime()) {
    const futureForecasts = forecastArray
      .map(f => ({ ...f, time: new Date(f.datetime).getTime() }))
      .filter(f => f.time >= now.getTime())
      .sort((a, b) => a.time - b.time);

    if (futureForecasts.length) {
      return {
        ...futureForecasts[0],
        source: 'fallback-forecast'
      };
    }

    // Fallback to current weather if no future forecast is found
    const weatherEntity = this._hass.states[this.config.weather_entity];
    if (weatherEntity) {
      return {
        temperature: weatherEntity.attributes.temperature,
        condition: weatherEntity.state,
        precipitation_probability: weatherEntity.attributes.precipitation_probability,
        source: 'current-weather'
      };
    }
  }

  return null;
}


previous_findForecastForLabel(label, forecastArray) {
  if (!label || !forecastArray?.length || !this._hass || !this.config?.weather_entity) {
    return null;
  }

  const [labelDayStr, labelTimeStr] = label.split(' ');
  const [labelHour, _labelMinute] = labelTimeStr.split(':').map(Number);

  const weekdayMap = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const targetWeekday = weekdayMap[labelDayStr];
  const now = new Date();
  const todayWeekday = now.getDay();
  const dayOffset = (targetWeekday - todayWeekday + 7) % 7;

  // Create label Date (local time), but round down to the hour
  const labelDate = new Date(now);
  labelDate.setDate(now.getDate() + dayOffset);
  labelDate.setHours(labelHour, 0, 0, 0); // <-- zero minutes/seconds

  const labelHourTime = labelDate.getTime();

  // Try to find forecast that exactly matches this hour (local time)
  for (const forecast of forecastArray) {
    const forecastDate = new Date(forecast.datetime); // UTC -> local
    if (forecastDate.getTime() === labelHourTime) {
      return {
        ...forecast,
        source: 'forecast'
      };
    }
  }

  // Optional fallback to current conditions if this hour isn't in forecast
  const isCurrentHour =
    now.getFullYear() === labelDate.getFullYear() &&
    now.getMonth() === labelDate.getMonth() &&
    now.getDate() === labelDate.getDate() &&
    now.getHours() === labelDate.getHours();

  if (isCurrentHour) {
    const entity = this._hass.states[this.config.weather_entity];
    if (entity) {
      return {
        source: 'current',
        datetime: new Date().toISOString(),
        condition: entity.state,
        temperature: entity.attributes.temperature,
        humidity: entity.attributes.humidity,
        precipitation_probability: entity.attributes.precipitation_probability
      };
    }
  }

  return null;
}


  getColumnDescription(column) {
        const headerClassesObject = {
          'time-column': { description: "Time", smallDescription: "<ha-icon icon='mdi:calendar-clock' style='--mdc-icon-size: 20px;'></ha-icon>"},
          'import-column': { description: "Import", smallDescription: "<ha-icon icon='mdi:transmission-tower-import' style='--mdc-icon-size: 20px;'></ha-icon>" },
          'export-column': { description: "Export", smallDescription: "<ha-icon icon='mdi:transmission-tower-export' style='--mdc-icon-size: 20px;'></ha-icon>" },
          'state-column': { description: "State", smallDescription: "State" },
          'limit-column': { description: "Limit", smallDescription: "<ha-icon icon='mdi:alert-circle-outline' style='--mdc-icon-size: 20px;'></ha-icon>" },
          'pv-column': { description: "PV kWh", smallDescription: "<ha-icon icon='mdi:solar-panel' style='--mdc-icon-size: 20px;'></ha-icon>" },
          'load-column': { description: "Load kWh", smallDescription: "<ha-icon icon='mdi:home-lightning-bolt' style='--mdc-icon-size: 20px;'></ha-icon>" },
          'soc-column': { description: "SoC", smallDescription: "<ha-icon icon='mdi:battery-80' style='--mdc-icon-size: 20px;'></ha-icon>" },
          'clip-column': { description: "Clip kWh", smallDescription: "Clip <br>kWh" },          
          'car-column': { description: "Car kWh", smallDescription: "<ha-icon icon='mdi:car-electric' style='--mdc-icon-size: 20px;'></ha-icon>" },
          'iboost-column': { description: "iBoost kWh", smallDescription: "<ha-icon icon='mdi:water-boiler' style='--mdc-icon-size: 20px;'></ha-icon>" },    
          'co2kg-column': {description: "CO2 kg", smallDescription: "CO2 kg" },
          'co2kwh-column': { description: "CO2 g/kWh", smallDescription: "CO2 g/kWh" },    
          'cost-column': { description: "Cost", smallDescription: "<ha-icon icon='mdi:currency-gbp' style='--mdc-icon-size: 20px;'></ha-icon>" },
          'total-column': { description: "Total Cost", smallDescription: "<ha-icon icon='mdi:currency-gbp' style='--mdc-icon-size: 18px;'></ha-icon><ha-icon icon='mdi:currency-gbp' style='--mdc-icon-size: 18px;'></ha-icon>" },
          'xload-column': { description: "XLoad kWh", smallDescription: "XLoad kWh" },
          'import-export-column': {description: "Import / Export", smallDescription: "<ha-icon icon='mdi:transmission-tower-import' style='--mdc-icon-size: 18px;'></ha-icon><ha-icon icon='mdi:transmission-tower-export' style='--mdc-icon-size: 18px;'></ha-icon>" },
          'net-power-column': {description: "Net kWh", smallDescription: "Net <br>kWh" }, 
          'weather-column': {description: "Weather", smallDescription: "<ha-icon icon='mdi:weather-partly-cloudy' style='--mdc-icon-size: 20px;'></ha-icon>" },
          'rain-column': {description: "Rain Chance", smallDescription: "<ha-icon icon='mdi:weather-pouring' style='--mdc-icon-size: 20px;'></ha-icon>" },
          'temp-column': {description: "Temp", smallDescription: "<ha-icon icon='mdi:thermometer' style='--mdc-icon-size: 20px;'></ha-icon>" },
          'options-column': {description: "Override", smallDescription: "<ha-icon icon='mdi:button-pointer' style='--mdc-icon-size: 20px;'></ha-icon>" },
          'options-popup-column': {description: "Override", smallDescription: "<ha-icon icon='mdi:button-pointer' style='--mdc-icon-size: 20px;'></ha-icon>" }
        };
        
        if (headerClassesObject.hasOwnProperty(column)) {
            // Return the description associated with the key

            if(this.isSmallScreen()){
                return headerClassesObject[column].smallDescription;
            } else {
                return headerClassesObject[column].description;
            }
            
        } else {
        // If the key does not exist, return a default description or handle the error as needed
        return "Description not found";
        }
  }
  
convertTimeStampToFriendly(timestamp){
    
    const date = new Date(timestamp.replace(/(\+\d{2})(\d{2})$/, "$1:$2")); // auto fix timezone colon
    
    const formatter = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    
    const formatted = formatter.format(date).replace(",", "");
    return formatted;
}
  
  getArrayDataFromRaw(raw, hassDarkMode) {
 
    let rowsToReturn = [];
    
    for (const row of raw.rows) {
        let rowDictionary = {};
        let color = "#FFFFFF";
        
        // change the color, logic from 
        // https://github.com/springfall2008/batpred/blob/dc18d2d9ffaae8b7b2fa4addf7f40bdec1da4890/apps/predbat/output.py#L1141
        
        let pvColor = color;
        if(row.pv_forecast >= 0.2)
            pvColor = "#FFAAAA";
        else if(row.pv_forecast >= 0.1)
            pvColor = "#FFFF00";
            
        let socColor = "#3AEE85";
        if(row.soc_percent < 20.0)
            socColor = "#F18261";
        else if (row.soc_percent < 50.0)
            socColor = "#FFFF00";
            
        let loadColor = color;
        if(row.load_forecast >= 0.5)
            loadColor = "#F18261";
        else if (row.load_forecast >= 0.25)
            loadColor = "#FFFF00";
        else if (row.load_forecast > 0.0)
            loadColor = "#AAFFAA";
            
        let stateColor = color;
        if(row.state === "FrzChrg")
            stateColor = "#EEEEEE";
        if(row.state === "HoldChrg")
            stateColor = "#34DBEB";
        if(row.state === "Chrg")
            stateColor = "#3AEE85"; 
        if(row.state === "FrzExp")
            stateColor = "#AAAAAA"; 
        if(row.state === "Exp")
            stateColor = "#FFFF00";
            
        
        const arrowGroups = {
          "→": ["Demand", "FrzExp"],
          "↗": ["Chrg"],
          "↘": ["Exp"],
        };
        
        const stateArrow =
          Object.entries(arrowGroups).find(([, states]) =>
            states.includes(row.state)
          )?.[0] || "";
        
        const costArrow =
          row.cost_change > 0 ? "↗" :
          row.cost_change < 0 ? "↘" :
          "→";
          
        const socArrow =
          row.soc_change > 0 ? "↗" :
          row.soc_change < 0 ? "↘" :
          "→";
        
        let trueCost = row.cost_change + " p " + costArrow;
        if(row.cost_change === 0)
            trueCost = "";
        
        if(row.pv_forecast === 0)
            row.pv_forecast = "";
            
            
        //{"value": "Both", "color": "green"};
        
        rowDictionary["time-column"] = {"value": this.convertTimeStampToFriendly(row.time), "color": color};
        rowDictionary["import-column"] = {"value": String(row.import_rate.toFixed(2)), "color": color};
        rowDictionary["export-column"] = {"value": String(row.export_rate.toFixed(2)), "color": color};
        rowDictionary["state-column"] = {"value": String(row.state) + socArrow, "color": stateColor};
        rowDictionary["limit-column"] = {"value": String(row.state_target), "color": color};
        rowDictionary["pv-column"] = {"value": String(row.pv_forecast) + "☀", "color": pvColor};
        rowDictionary["load-column"] = {"value": String(row.load_forecast), "color": loadColor};
        rowDictionary["soc-column"] = {"value": String(row.soc_percent) + socArrow, "color": socColor};
        rowDictionary["cost-column"] = {"value": String(trueCost), "color": color};
        rowDictionary["total-column"] = {"value": "£" + String(row.total_cost.toFixed(2)), "color": color};
        if(row.car_charging !== undefined && row.car_charging !== null)
            rowDictionary["car-column"] = {"value": String(row.car_charging), "color": color};
        if(row.clipped !== undefined && row.clipped !== null)
            rowDictionary["clip-column"] = {"value": String(row.clipped), "color": color};
        if(row.iboost !== undefined && row.iboost !== null)
            rowDictionary["iboost-column"] = {"value": String(row.iboost), "color": color};

        const num = (x) => Number.isFinite(parseFloat(x)) ? parseFloat(x) : 0;
        const netPower = (
          num(row?.pv_forecast) -
          num(row?.load_forecast) -
          num(row?.car_charging) -
          num(row?.iboost)
        ).toFixed(2);
        
        rowDictionary["net-power-column"] = {"value": netPower, "color": color};
        
        // weather forecast
        if(this.forecast){
            let weatherColor = "#FFFFFF"; // var(--primary-text-color)
            const match = this.findForecastForLabel(this.convertTimeStampToFriendly(row.time), this.forecast);
            if(match !== undefined && match !== null){
                let matchStore = match;
                
                if(this.isLabelDuringNight(this.convertTimeStampToFriendly(row.time), this._hass) && match.condition === "partlycloudy")
                    matchStore.condition = "partlycloudynight";
                
                const weatherEntity = this._hass.states[this.config.weather_entity];
                const tempUnit = weatherEntity?.attributes?.temperature_unit || this._hass.config.unit_system.temperature;
                
                if((tempUnit === "°F" && match.temperature >= 77) || (tempUnit === "°C" && match.temperature >= 25))
                    weatherColor = "rgb(220, 67, 20)";
                
                if((tempUnit === "°F" && match.temperature <= 32) || (tempUnit === "°C" && match.temperature <= 0))
                    weatherColor = "rgb(31, 136, 207)";
                
                rowDictionary["weather-column"] = {"value": matchStore, "color": weatherColor};
                rowDictionary["temp-column"] = {"value": matchStore, "color": weatherColor};
                rowDictionary["rain-column"] = {"value": matchStore, "color": weatherColor};
            } else {
                rowDictionary["weather-column"] = {"value": null, "color": null};
                rowDictionary["temp-column"] = {"value": null, "color": null};
                rowDictionary["rain-column"] = {"value": null, "color": null};
            }
        }        
            
        rowsToReturn.push(rowDictionary);
    }
    
    return rowsToReturn;
    
  }
  
  getArrayDataFromHTML(html, hassDarkMode) {
      
      // Define column headers and corresponding classes
  const headerClassesArray = [
      'time-column',
      'import-column',
      'export-column',
      'state-column',
      'limit-column',
      'pv-column',
      'load-column',
      'soc-column',
      'cost-column',
      'total-column'
    ];  
    
    let totalCostCalculated = 0;
    
      // Create a dummy element to manipulate the HTML
      const dummyElement = document.createElement('div');
      dummyElement.innerHTML = html;
    
        // Find all <tr> elements in the table body
        const trElements = dummyElement.querySelectorAll('tbody tr');
        
        // Loop through each <tr> element
        
        let rowCount = 0;
        
        const newDataObject = [];
        
        let currentExportRate;
        let currentExportColor;
        
        let firstRowData = 0;
        
        /*
        const str = "1.79 (0.75)";

        // Step 1: Use a regular expression to find all float numbers
        const floatRegex = /-?\d+(\.\d+)?/g; // This regex matches positive and negative floats
        const matches = str.match(floatRegex); // Get an array of matches
        
        // Step 2: Convert the matches to floating-point numbers
        const floats = matches.map(match => parseFloat(match));
        
        // Step 3: Loop through each float and do something with it
        floats.forEach(float => {
            console.log(float); // Here you can replace this line with whatever you want to do with each float
        });*/
        
        trElements.forEach((trElement, index) => {
            if(firstRowData === 0){
                const numberOfChildren = trElement.children.length;
                
                //detect if row data is actual table data not metadata. If children <td> is greater than 2
                if(numberOfChildren > 2){
                    firstRowData = index;
                }
            }
        }); 
        
        let isCostReset = false;
        let currentCost = 0;
        
        trElements.forEach((trElement, index) => {
        
        const tdElements = trElement.querySelectorAll('td');
        const thElements = trElement.querySelectorAll('th');
        
            if (index === firstRowData) {
                
                let headerCountback = 0;
                let headerElements = trElement.querySelectorAll('th');
                if(tdElements.length > 0){
                    headerElements = trElement.querySelectorAll('td');
                    headerCountback = 1;
                }

                //check for car column in the first row and add new car-column class to array in position 7
                headerElements.forEach((tdElement, checkIndex) => {
                    let columnHeaderTitle = tdElement.innerHTML.toUpperCase();
                    if (columnHeaderTitle.includes("CAR")) {
                        headerClassesArray.splice(checkIndex-headerCountback, 0, "car-column");
                    }
                    if(columnHeaderTitle.includes("IBOOST")) {
                        headerClassesArray.splice(checkIndex-headerCountback, 0, "iboost-column");
                    }
                    
                    if(columnHeaderTitle.includes("CO2 G/KWH")) {
                        headerClassesArray.splice(checkIndex-headerCountback, 0, "co2kwh-column");
                    }  
                    
                    if(columnHeaderTitle.includes("CO2 KG")) {
                        headerClassesArray.splice(checkIndex-headerCountback, 0, "co2kg-column");
                    }

                    if(columnHeaderTitle.includes("XLOAD")) {
                        headerClassesArray.splice(checkIndex-headerCountback, 0, "xload-column");
                    }                    
                    if(columnHeaderTitle.includes("CLIP KWH")) {
                        headerClassesArray.splice(checkIndex-headerCountback, 0, "clip-column");
                    }                       

                });
                
            }
            
            if (index > firstRowData && index < (trElements.length -1)) {

                // helps with the math when columns count and colspan at work
                let countDifference = Object.keys(headerClassesArray).length - tdElements.length;
                
                let newTRObject = {};
                
                // Loop through each <td> element inside the current <tr>
                tdElements.forEach((tdElement, tdIndex) => {
                    
                    const userResetFlag = this.config.reset_day_totals;
                    if(tdIndex === 0 && tdElement.innerHTML.includes("00:00") && userResetFlag)
                        isCostReset = true;
                    
                    let bgColor = tdElement.getAttribute('bgcolor'); 
                    if (bgColor && !bgColor.startsWith('#')) {
                        bgColor = `#${bgColor}`;
                    }
                    
                    if(bgColor !== null){
                        if(bgColor.toUpperCase() === "#FFFFFF" && tdIndex != 1 && tdIndex != 2 && (this.config.old_skool !== true) && this.getLightMode(hassDarkMode) !== true)
                            bgColor = "var(--primary-text-color)";
                    } else {
                        bgColor = "#FFFFFF";
                    }
                            
                    if(this.getLightMode(hassDarkMode) === false && this.config.old_skool !== true){
                        
                        // light mode active so adjust the colours from trefor
                        bgColor = this.getDarkenHexColor(bgColor, 30);
                        
                    }
                    
                    if(tdIndex ===2){
                        currentExportRate = tdElement.innerHTML;
                        currentExportColor = bgColor;
                    }
                    
                    let headerIndex;
                    if(tdIndex <= 2){
                        headerIndex = tdIndex
                    } else {
                        //2
                        if(countDifference != 0){
                            headerIndex = tdIndex+countDifference;
                        } else {
                            headerIndex = tdIndex;
                        }
                    }
                    
                    // set the right bgColor if old_skool_columns are set, and valid.
                    
                    if(this.config.old_skool_columns !== undefined && this.config.old_skool_columns.length > 0 && this.config.old_skool_columns.includes(headerClassesArray[headerIndex])){
                         if(tdElement.getAttribute('bgcolor') != "#FFFFFF"){
                             bgColor = tdElement.getAttribute('bgcolor');
                         } else {
                            bgColor = null; 
                         }                    
                    }
                    
                    if(headerClassesArray[headerIndex] === "cost-column" && !isNaN(parseFloat(tdElement.innerHTML))){
                        currentCost = parseFloat(tdElement.innerHTML);
                    }
                        
                    if(headerClassesArray[headerIndex] === "cost-column" && !isNaN(parseFloat(tdElement.innerHTML)) && isCostReset)
                        totalCostCalculated += parseFloat(tdElement.innerHTML);
                    
                    
                    if(headerClassesArray[headerIndex] === "total-column") {
                        
                        let totalCostString;
                        
                        if(this.config.fix_totals){
                            let value = parseFloat(tdElement.innerHTML.replace(/[^0-9.\-]/g, ""));
                            totalCostString = "£" + (value + (currentCost/100)).toFixed(3);
                        }
                        
                        // calculate new cost
                        if(isCostReset)
                            totalCostString = "£" + (totalCostCalculated / 100).toFixed(2);
                        
                        if(!isCostReset && !this.config.fix_totals)
                            totalCostString = tdElement.innerHTML;
                        
                        newTRObject[headerClassesArray[headerIndex]] = {"value": totalCostString, "color": bgColor};
                    } else
                        newTRObject[headerClassesArray[headerIndex]] = {"value": tdElement.innerHTML, "color": bgColor};

                    //exception||override for 12 cells and 11 headers (-1 count difference) and handling index 2
                    if(countDifference < 0 && tdIndex == 3) {
                        // having to do some nasty overrides here because of colspan stuff and my brain cant do the math today. will fix.
                         newTRObject[headerClassesArray[2]] = {"value": currentExportRate, "color": currentExportColor};
                        
                    }

                });
                
                //if there are no state & limit cells because they are spanning rows, get the previous row data
                if(Object.keys(newTRObject).length < Object.keys(headerClassesArray).length){
                    //I need to insert state and limit vals
                    newTRObject[headerClassesArray[3]] = newDataObject[newDataObject.length - 1][headerClassesArray[3]];
                    newTRObject[headerClassesArray[4]] = newDataObject[newDataObject.length - 1][headerClassesArray[4]];
                }
                
                // state is actually two states, so we should replace that with "both"
                if(countDifference < 0) {
                    tdElements.forEach((tdElement, tdIndex) => {
                        if(tdIndex === 3){
                            if(tdElement.innerHTML.includes("Chrg"))
                                newTRObject[headerClassesArray[3]] = {"value": "Both", "color": "green"};
                            else if(tdElement.innerHTML.trim() === "↘")
                                    newTRObject[headerClassesArray[3]] = {"value": "Both-Dis", "color": "green"};
                            else if(tdElement.innerHTML.trim() === "↗")
                                    newTRObject[headerClassesArray[3]] = {"value": "Both-Chg", "color": "green"};
                            else if(tdElement.innerHTML.trim() === "→")
                                    newTRObject[headerClassesArray[3]] = {"value": "Both-Idle", "color": "green"};
                        }
                        if(tdIndex === 4){
                            if(tdElement.innerHTML.includes("🐌"))
                                newTRObject[headerClassesArray[3]] = {"value": "Both-Dis-Snail", "color": "green"};
                        }
                    });
                }
                
                newTRObject["import-export-column"] = [newTRObject[headerClassesArray[1]], newTRObject[headerClassesArray[2]]];
                
                // weather forecast
                if(this.forecast){
                    let weatherColor = "#FFFFFF"; // var(--primary-text-color)
                    const match = this.findForecastForLabel(newTRObject["time-column"].value, this.forecast);
                    if(match !== undefined && match !== null){
                        let matchStore = match;
                        
                        if(this.isLabelDuringNight(newTRObject["time-column"].value, this._hass) && match.condition === "partlycloudy")
                            matchStore.condition = "partlycloudynight";
                        
                        const weatherEntity = this._hass.states[this.config.weather_entity];
                        const tempUnit = weatherEntity?.attributes?.temperature_unit || this._hass.config.unit_system.temperature;
                        
                        if((tempUnit === "°F" && match.temperature >= 77) || (tempUnit === "°C" && match.temperature >= 25))
                            weatherColor = "rgb(220, 67, 20)";
                        
                        if((tempUnit === "°F" && match.temperature <= 32) || (tempUnit === "°C" && match.temperature <= 0))
                            weatherColor = "rgb(31, 136, 207)";
                        
                        newTRObject["weather-column"] = {"value": matchStore, "color": weatherColor};
                        newTRObject["temp-column"] = {"value": matchStore, "color": weatherColor};
                        newTRObject["rain-column"] = {"value": matchStore, "color": weatherColor};
                    } else {
                        newTRObject["weather-column"] = {"value": null, "color": null};
                        newTRObject["temp-column"] = {"value": null, "color": null};
                        newTRObject["rain-column"] = {"value": null, "color": null};
                    }
                    //console.log("Label: " + newTRObject["time-column"].value + " - Forecast Time: " + match.datetime);
                    
                }

                // net-power-column

                const loadIndex = headerClassesArray.indexOf("load-column");
                const pvIndex = headerClassesArray.indexOf("pv-column");
                const carIndex = headerClassesArray.indexOf("car-column");
                const iBoostIndex = headerClassesArray.indexOf("iboost-column");

                let pvValue = 0;
                let loadValue = 0;
                let carValue = 0;
                let iBoostValue = 0;
                
                if(pvIndex !== -1){
                    pvValue = newTRObject[headerClassesArray[pvIndex]].value.replace(/[☀]/g, '');
                    if(pvValue.length === 0 || Number.isNaN(parseFloat(pvValue)))
                        pvValue = 0;
                }
                
                if(loadIndex !== -1){
                    loadValue = newTRObject[headerClassesArray[loadIndex]].value;
                    if(loadValue.length === 0 || Number.isNaN(parseFloat(loadValue)))
                        loadValue = 0;
                }                

                if(carIndex !== -1){
                    carValue = newTRObject[headerClassesArray[carIndex]].value;
                    if(carValue.length === 0 || Number.isNaN(parseFloat(carValue)))
                        carValue = 0;
                }
                if(iBoostIndex !== -1){
                    iBoostValue = newTRObject[headerClassesArray[iBoostIndex]].value;
                    if(iBoostValue.length === 0 || Number.isNaN(parseFloat(iBoostValue)))
                        iBoostValue = 0;
                }
                    
                //console.log(parseFloat(pvValue) + " " + parseFloat(loadValue) + " " + parseFloat(carValue) + " " + parseFloat(iBoostValue));
                
                const netPower = (parseFloat(pvValue) - parseFloat(loadValue) - parseFloat(carValue) - parseFloat(iBoostValue)).toFixed(2);
                const positiveColor = "#3AEE85";
                const negativeColor = "#F18261";
                let adjustedColor;
                
                if(netPower > 0){
                    adjustedColor = positiveColor;
                    if(this.getLightMode(hassDarkMode) === false && this.config.old_skool !== true)
                        adjustedColor = this.getDarkenHexColor(positiveColor, 30);
                    if(this.config.old_skool_columns !== undefined && this.config.old_skool_columns.length > 0 && this.config.old_skool_columns.includes("net-power-column"))
                        adjustedColor = positiveColor;
                } else {
                    adjustedColor = negativeColor;
                    if(this.getLightMode(hassDarkMode) === false && this.config.old_skool !== true)
                        adjustedColor = this.getDarkenHexColor(negativeColor, 30);
                    
                    if(this.config.old_skool_columns !== undefined && this.config.old_skool_columns.length > 0 && this.config.old_skool_columns.includes("net-power-column"))
                        adjustedColor = negativeColor;
                }
                
                newTRObject["net-power-column"] = {"value": netPower, "color": adjustedColor};
                newDataObject.push(newTRObject);
            }
            
            if(index === (trElements.length -1)){
                
            }
            
        });
    
      // Get the modified HTML
      
      //const newDate = this.getStringToDate(newDataObject[30]['time-column'].value);
      
      //console.log(newDate);
      //console.log(newDataObject[30]['time-column'].value);
      
      return newDataObject;
    }
    
    getStringToDate(input) {
        const [day, time] = input.split(' '); // Split into "Tue" and "09:00"
        const [hours, minutes] = time.split(':').map(Number); // Split and convert time to numbers
    
        // Map days of the week to numbers (Sunday = 0, Monday = 1, ..., Saturday = 6)
        const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const targetDay = dayMap[day];
    
        if (targetDay === undefined) {
            throw new Error('Invalid day in input');
        }
    
        // Get today's date
        const now = new Date();
        const currentDay = now.getDay();
    
        // Calculate the difference between today and the target day
        const dayDifference = (targetDay - currentDay + 7) % 7; // Ensures it's positive
        const targetDate = new Date(now);
    
        // Set the target date to the upcoming target day
        targetDate.setDate(now.getDate() + dayDifference);
    
        // Set the time
        targetDate.setHours(hours, minutes, 0, 0);
    
        return targetDate;
    }    
  
	getStyles(isDarkMode) {
	   
	//defaults 
	let tableWidth = 100;
	let oddColour;
	let evenColour;
	let maxHeight = "28px";
	let tableHeaderFontColour;
	let tableHeaderBackgroundColour;
	let tableHeaderColumnsBackgroundColour;
	let boldTextDisplay, dayTotalFontColour, dayTotalBackgroundColour, totalBackgroundColour, dividerColour, tableBorderColor, planTotalFontColour, dayTotalShadowColor;
	
	if(isDarkMode){
	    oddColour = "#181f2a";
	    evenColour = "#2a3240";
	    tableHeaderColumnsBackgroundColour = evenColour;
	    
    	if(this.config.odd_row_colour !== undefined){
    	    oddColour = this.config.odd_row_colour;
    	}
    	
    	if(this.config.even_row_colour !== undefined){
    	    evenColour = this.config.even_row_colour;
    	    tableHeaderColumnsBackgroundColour = this.config.even_row_colour;
    	}
    	tableHeaderFontColour = "#8a919e";
    	tableHeaderBackgroundColour = "transparent";
    	boldTextDisplay = "font-weight: normal;";
    	dayTotalFontColour = "rgba(255, 255, 255, 0.7)";
    	planTotalFontColour = "rgba(255, 255, 255, 1.0)";
    	dayTotalBackgroundColour = evenColour;
    	totalBackgroundColour = oddColour;
    	dividerColour = "rgb(105, 109, 114)";
    	tableBorderColor = "rgba(105, 109, 114, 0.6)";
    	dayTotalShadowColor = "rgba(0, 0, 0, 0.7)";
    	
	} else {
	    // Light Theme
	    //oddColour = "#d2d3db"; //848ea1
	    //evenColour =  "#9394a5"; //2a3240
	    
	    oddColour = "#FFFFFF";
	    evenColour = "#E5E5E5"
	    
    	if(this.config.odd_row_colour_light !== undefined){
    	    oddColour = this.config.odd_row_colour_light;
    	}
    	
    	if(this.config.even_row_colour_light !== undefined){
    	    evenColour = this.config.even_row_colour_light;
    	}	
    	tableHeaderFontColour = "#FFFFFF";
    	tableHeaderBackgroundColour = "var(--primary-color)";
    	tableHeaderColumnsBackgroundColour = "var(--primary-color)";
    	boldTextDisplay = "font-weight: bold;";
    	dayTotalFontColour = "var(--darker-primary-color)";
    	planTotalFontColour = "rgba(255, 255, 255, 0.9)";
 	    dayTotalBackgroundColour = "var(--light-primary-color)";
    	totalBackgroundColour = tableHeaderBackgroundColour; 
    	dividerColour = "var(--primary-color)";
    	tableBorderColor = "var(--primary-color)";
    	dayTotalShadowColor = "#FFFFFF";
	}
	
	//use yaml width if exists
	if(this.config.table_width !== undefined){
	    tableWidth = this.config.table_width;
	}
	
	if(this.config.columns !== undefined && this.config.columns.indexOf("import-export-column") >= 0){
	    if(this.config.stack_pills === true || this.config.stack_pills === undefined)
	        maxHeight = "54px";
	}
	
	if(this.config.old_skool === true)
	    maxHeight = "28px";
	    
	let fontSize = 14;
	const tempSizeDiff = 3;
	let tempUnitSize = fontSize - tempSizeDiff;
	//use yaml font size if exists
	if(this.config.font_size !== undefined){
	    fontSize = this.config.font_size;
	    tempUnitSize = parseFloat(this.config.font_size) - tempSizeDiff;
	}
	    
		return `
    .card-content table {
      /* Your styles for the table inside .card-content */
      border: 1px solid ${tableBorderColor};
      width: ${tableWidth}%;
      border-spacing: 0px;
      font-size: ${fontSize}px;
    }
    
    .card-content table tbody tr:nth-child(even) {
        background-color: ${evenColour};
    }


    .card-content table tbody tr:nth-child(odd) {
      background-color:  ${oddColour};
    }
    
    .card-content table thead tr th {
        background-color: ${tableHeaderColumnsBackgroundColour};
        height: 28px;
        color: ${tableHeaderFontColour};
        text-align: center; !important
    }
    
    .tempUnit {
        font-size: ${tempUnitSize}px;
    }
    
    .totalRow {
        background-color: ${totalBackgroundColour} !important; 
        height: 24px;
        color: ${planTotalFontColour};
        text-align: center !important;
        text-shadow: 0px 1px 1px rgba(0, 0, 0, 0.7);
    }    
    
    .totalRow td {
        border-top: 2px solid ${tableBorderColor} !important;
        border-bottom: 1px solid ${tableBorderColor} !important;
    }    
    
    .dayTotalRow {
        background-color: ${dayTotalBackgroundColour} !important; 
        height: 24px;
        color: ${dayTotalFontColour};
        text-align: center !important;
        text-shadow: 0px 1px 1px ${dayTotalShadowColor};
    }        
    
    .lastUpdateRow {
        height: 24px;
        font-weight: normal;
        font-size: ${fontSize}px;
        text-align: center;
        padding-bottom: 4px;
    }
    
    .versionRow {
        height: 24px;
        font-weight: normal;
        text-align: center;
        padding-top: 4px;
        font-size: ${fontSize}px;
    }
    
    
    .card-content table thead tr .topHeader {
        background-color: ${tableHeaderColumnsBackgroundColour};
    }

    
    .daySplitter {
        height: 1px;
        background-color: ${dividerColour};
    }    
    
    .card-content table tbody tr td {
        padding: 0px;
        padding-left: 2px;
        padding-right: 2px; 
        height: ${maxHeight};
        vertical-align: middle;
        align-items: center;
        border: 0;
        text-align: center;
        white-space: nowrap;

    }
    
    .card-content table tbody tr td .pill {
       text-shadow: 0px 0px 0px rgba(0, 0, 0, 0.0);
    }
    
    .card-content table tbody tr td .icons {
    /*    filter: drop-shadow(1px 1px 0px rgba(0, 0, 0, 0.6));*/
    }
    
    .card-content tbody tr td:nth-child(1) {
      white-space: normal;
    }
    
    
    #limitSVG {
      position: relative;
      top: 0px;
    }
    
    .iconContainer {
      display: flex;
      align-items: center; /* Center content vertically */
      justify-content: center; /* Center content horizontally */
      height: 100%; /* Set height of table cell */
      --font-weight: bold;
    }
    
    .iconContainerSOC {
      display: flex;
      align-items: center; /* Center content vertically */
    }    
    
    .multiPillContainer {
      align-items: center; /* Center content vertically */
      justify-content: center; /* Center content horizontally */
      height: 54px; /* Set height of table cell */
      margin-top: 4px;
     
    }
    
    .pulse-icon {
      animation: pulse-opacity 1.1s infinite alternate;
    }
    
    .icon-spin {
        display: inline-block;
        animation: spin 1.8s linear infinite;
        transform-origin: 46% 56%;
    }
    
    @keyframes pulse-opacity {
        from {
            opacity: 0.2;
        }
        to {
            opacity: 1;
        }
    }
    
    @keyframes spin {
        from { 
            transform: rotate(0deg); 
        }
        to { 
            transform: rotate(360deg);
        }
    }
    
    `;
	}
	
    getLightModeColor(hexColor) {
      // Convert HEX color to RGB
      let r = parseInt(hexColor.substring(1, 3), 16);
      let g = parseInt(hexColor.substring(3, 5), 16);
      let b = parseInt(hexColor.substring(5, 7), 16);
    
      // Calculate the light mode color (increase each RGB component)
      let lightR = Math.min(r + 0, 255);
      let lightG = Math.min(g - 30, 255);
      let lightB = Math.min(b - 30, 255);
    
      // Convert the updated RGB values back to HEX
      let lightHexColor = '#' + ((1 << 24) + (lightR << 16) + (lightG << 8) + lightB).toString(16).slice(1);
    
      return lightHexColor;
    }	

    getVibrantColor(hexColor, percent) {
      // Convert HEX color to RGB
      let r = parseInt(hexColor.substring(1, 3), 16);
      let g = parseInt(hexColor.substring(3, 5), 16);
      let b = parseInt(hexColor.substring(5, 7), 16);
    
      // Calculate the amount to increase the RGB values based on the percent vibrancy
      let increase = Math.round(percent / 100 * 255);
    
      // Increase the RGB values to make the color more vibrant
      r = Math.min(r + increase, 255);
      g = Math.min(g + increase, 255);
      b = Math.min(b + increase, 255);
    
      // Convert the updated RGB values back to HEX
      let vibrantHexColor = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    
      return vibrantHexColor;
    }	
	
	getDarkenHexColor(hexColor, percent) {
	    
	    
          // Ensure the percent is within the valid range
          percent = Math.max(0, Math.min(100, percent));
        
          // Convert HEX to RGB
          let r = parseInt(hexColor.slice(1, 3), 16);
          let g = parseInt(hexColor.slice(3, 5), 16);
          let b = parseInt(hexColor.slice(5, 7), 16);
        
          // Calculate the darkness factor
          let factor = 1 - percent / 100;
        
          // Darken the RGB values
          r = Math.floor(r * factor);
          g = Math.floor(g * factor);
          b = Math.floor(b * factor);
        
          // Ensure RGB values are within the valid range (0-255)
          r = Math.min(255, Math.max(0, r));
          g = Math.min(255, Math.max(0, g));
          b = Math.min(255, Math.max(0, b));
          
          //console.log(r + " " + g + " " + b);
        
          // Convert RGB back to HEX
          const darkenedHexColor = `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
        
          return darkenedHexColor;
        }
        
    getLightenHexColor(hexColor, percent) {
      // Ensure the percent is within the valid range
      percent = Math.max(0, Math.min(100, percent));
    
      // Convert HEX to RGB
      let r = parseInt(hexColor.slice(1, 3), 16);
      let g = parseInt(hexColor.slice(3, 5), 16);
      let b = parseInt(hexColor.slice(5, 7), 16);
    
      // Calculate the brightness factor
      let factor = 1 + percent / 100;
    
      // Lighten the RGB values
      r = Math.min(255, Math.round(r * factor));
      g = Math.min(255, Math.round(g * factor));
      b = Math.min(255, Math.round(b * factor));
    
      // Convert RGB back to HEX
      const lightenedHexColor = `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    
      return lightenedHexColor;
    }
}

customElements.define("predbat-table-card", PredbatTableCard);

window.customCards = window.customCards || [];
window.customCards.push({
							type: "predbat-table-card",
							name: "PredBat TableCard",
							preview: true,
							description: "Predbat Card showing the plan table in a nicer format",
							documentationURL: "https://github.com/pacemaker82/PredBat-Table-Card/blob/main/README.md"
						});
