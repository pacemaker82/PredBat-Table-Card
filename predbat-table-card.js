class PredbatTableCard extends HTMLElement {

  // The user supplied configuration. Throw an exception and Home Assistant
  // will render an error card.
  setConfig(config) {
    if (!config.entity) {
      throw new Error("You need to set the predbat entity");
    }
    if (!config.columns) {
      throw new Error("You need to define a list of columns (see docs)");
    } else if(config.columns.includes("weather-column") && !config.weather_entity) {
        throw new Error("To use weather-column you need to include a weather_entity in your YAML");
    }
    
    this.config = config;

  }    
    
  // Whenever the state changes, a new `hass` object is set. Use this to
  // update your content.
  
    static getConfigElement() {
        // Create and return an editor element
        // return document.createElement("predbat-table-card-editor");
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
        this.processAndRender(hass);
    } else {
        const oldEntityUpdateTime = oldHass.states[entityId].last_updated;
        const newEntityUpdateTime = hass.states[entityId].last_updated;
        
        //only render new HTML if the entity actually changed
        if(oldEntityUpdateTime !== newEntityUpdateTime){
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
          console.log(`[${new Date().toLocaleTimeString()}] FORECAST READY FOR RENDER`);
          console.log(this.forecast);
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
  
  processAndRender(hass){
     
    console.log(`[${new Date().toLocaleTimeString()}] PROCESS AND RENDER TABLE`);
    /*  
    this.hass.callWS({
        type: "weather/forecast",
        entity_id: "weather.forecast_stone_cottage",
        forecast_type: "daily" // or "hourly"
    }); */
      
    const entityId = this.config.entity;
    
    const state = hass.states[entityId];
    const stateStr = state ? state.state : "unavailable";

    if (stateStr === "unavailable") {
      throw new Error("Predbat HTML entity is not currently available. Hit REFRESH when it is...");
    }
    
    // Predbat Version entity
    const versionEntity = this.config.version_entity;

    let columnsToReturn = this.config.columns;
    let rawHTML = hass.states[entityId].attributes.html;
    const dataArray = this.getArrayDataFromHTML(rawHTML, hass.themes.darkMode); 
    //filter out any columns not in the data
    columnsToReturn = columnsToReturn.filter(column => {
        return dataArray[0][column] !== undefined;
    });

    let theTable = document.createElement('table');
    theTable.setAttribute('id', 'predbat-table');
    theTable.setAttribute('cellpadding', '0px');
    let newTableHead = document.createElement('thead');
    
    // Create an optional Last Updated Table Header Row
    if(this.config.hide_last_update !== true) {
        
        const lastUpdated = state ? state.last_updated : "Unavailable";
        const time = this.getLastUpdatedFromHTML(lastUpdated);

        if (time !== undefined){
            let lastUpdateHeaderRow = document.createElement('tr');
            let lastUpdateCell = document.createElement('th');
            lastUpdateCell.classList.add('lastUpdateRow');
            lastUpdateCell.colSpan = columnsToReturn.length;
            lastUpdateCell.innerHTML = `<b>Plan Last Updated:</b> ${time}`;
            lastUpdateHeaderRow.appendChild(lastUpdateCell);
            newTableHead.appendChild(lastUpdateHeaderRow);
        }
    }
    
    // set out the data rows
    let newTableBody = document.createElement('tbody');
    
    let loadTotal = 0, pvTotal = 0, carTotal = 0, iboostTotal = 0, netTotal = 0, costTotal = 0, clipTotal = 0, co2kwhTotal = 0, co2kgTotal = 0, xloadTotal = 0, 
    loadDayTotal = 0, pvDayTotal = 0, carDayTotal = 0, iboostDayTotal = 0, netDayTotal = 0, costDayTotal = 0, clipDayTotal = 0, co2kwhDayTotal = 0, co2kgDayTotal = 0, xloadDayTotal = 0;

    // create the data rows
    dataArray.forEach((item, index) => {
        
        let newRow = document.createElement('tr');
        
        let isMidnight = false;
        columnsToReturn.forEach((column, index) => { // Use arrow function here
            if(item[column] !== undefined){
                //console.log(column + " " + item[column]);
                if(item["time-column"].value.includes("23:30"))
                    isMidnight = true;
                
                let newColumn = this.getCellTransformation(item[column], column, hass.themes.darkMode);
    
                newRow.appendChild(newColumn); 
                
                if(column === "load-column" && !item["load-column"].value.includes("⚊")) {
                    let val = parseFloat(item["load-column"].value);
                    loadTotal += val;
                    loadDayTotal += val;
                }
                if(column === "pv-column" && !item["pv-column"].value.includes("⚊")) {
                    let val = parseFloat(item["pv-column"].value.replace(/[☀]/g, ''));
                    pvTotal += val;
                    pvDayTotal += val;
                }
                if(column === "car-column" && !item["car-column"].value.includes("⚊")) {
                    let val = parseFloat(item["car-column"].value);
                    carTotal += val;
                    carDayTotal += val;
                }
                if(column === "net-power-column" && !item["net-power-column"].value.includes("⚊")) {
                    let val = parseFloat(item["net-power-column"].value);
                    netTotal += val;
                    netDayTotal += val;
                }
                if(column === "cost-column" && !item["cost-column"].value.includes("→")) {
                    let val = parseFloat(item["cost-column"].value.replace(/[↘↗→p]/g, ''));
                    costTotal += val;
                    costDayTotal += val;
                }
                if(column === "iboost-column" && !item["iboost-column"].value.includes("⚊")) {
                    let val = parseFloat(item["iboost-column"].value);
                    iboostTotal += val;
                    iboostDayTotal += val;
                }
                if(column === "clip-column" && !item["clip-column"].value.includes("⚊")) {
                    let val = parseFloat(item["clip-column"].value);
                    clipTotal += val;
                    clipDayTotal += val;
                }
                if(column === "xload-column" && !item["xload-column"].value.includes("⚊")) {
                    let val = parseFloat(item["xload-column"].value);
                    xloadTotal += val;
                    xloadDayTotal += val;
                }
                if(column === "co2kwh-column" && !item["co2kwh-column"].value.includes("⚊")) {
                    let val = parseFloat(item["co2kwh-column"].value);
                    co2kwhTotal += val;
                    co2kwhDayTotal += val;
                }
                if(column === "co2kg-column" && !item["co2kg-column"].value.includes("⚊")) {
                    let val = parseFloat(item["co2kg-column"].value);
                    co2kgTotal += val;
                    co2kgDayTotal += val;
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
                    
                    if(column === "time-column" && index === 0)
                        totalCell.innerHTML = `<b>TOTALS</b>`;                    
            
                    if(column === 'pv-column')
                        totalCell.innerHTML = `<b>${pvDayTotal.toFixed(2)}</b>`;
                    
                    if(column === 'car-column')
                        totalCell.innerHTML = `<b>${carDayTotal.toFixed(2)}</b>`;
                    
                    if(column === 'load-column')
                        totalCell.innerHTML = `<b>${loadDayTotal.toFixed(2)}</b>`;
                        
                    if(column === 'net-power-column')
                        totalCell.innerHTML = `<b>${netDayTotal.toFixed(2)}</b>`; 
                        
                    let formattedCost = "";
                    
                    if (costDayTotal < 0) {
                      formattedCost = `-£${(Math.abs(costDayTotal) / 100).toFixed(2)}`;
                    } else {
                      formattedCost = `£${(costDayTotal / 100).toFixed(2)}`;
                    }                
                    
                    if(column === 'cost-column')
                        totalCell.innerHTML = `<b>${formattedCost}</b>`; 
                        
                    if(column === 'clip-column')
                        totalCell.innerHTML = `<b>${clipDayTotal.toFixed(2)}</b>`;
                    if(column === 'xload-column')
                        totalCell.innerHTML = `<b>${xloadDayTotal.toFixed(2)}</b>`;                 
                    if(column === 'co2kwh-column')
                        totalCell.innerHTML = `<b>${co2kwhDayTotal.toFixed(2)}</b>`;    
                    if(column === 'co2kg-column')
                        totalCell.innerHTML = `<b>${co2kgDayTotal.toFixed(2)}</b>`;                 
                    
                    dayTotalsRow.appendChild(totalCell);
                
                });
                
                newTableBody.appendChild(dayTotalsRow);            
                loadDayTotal = 0, pvDayTotal = 0, carDayTotal = 0, iboostDayTotal = 0, netDayTotal = 0, costDayTotal = 0, clipDayTotal = 0, co2kwhDayTotal = 0, co2kgDayTotal = 0, xloadDayTotal = 0;
                for (let i = 0; i < 2; i++) {
                    newTableBody.appendChild(this.createDividerRows(columnsToReturn.length, hass.themes.darkMode));
                }   
            }
        }
    });
    
    // Create an optional Last Updated Table Header Row
    if(this.config.show_totals === true || this.config.show_plan_totals === true) {
        
        let totalsRow = document.createElement('tr');
        totalsRow.classList.add('totalRow');
        
        columnsToReturn.forEach((column, index) => {
            
            let totalCell = document.createElement('td');
            
            if(column === "time-column" && index === 0)
                totalCell.innerHTML = `<b>PLAN TOTALS</b>`;
    
            if(column === 'pv-column')
                totalCell.innerHTML = `<b>${pvTotal.toFixed(2)}</b>`;
            
            if(column === 'car-column')
                totalCell.innerHTML = `<b>${carTotal.toFixed(2)}</b>`;
            
            if(column === 'load-column')
                totalCell.innerHTML = `<b>${loadTotal.toFixed(2)}</b>`;
                
            if(column === 'net-power-column')
                totalCell.innerHTML = `<b>${netTotal.toFixed(2)}</b>`; 
                
            let formattedCost = "";
            
            if (costTotal < 0) {
              formattedCost = `-£${(Math.abs(costTotal) / 100).toFixed(2)}`;
            } else {
              formattedCost = `£${(costTotal / 100).toFixed(2)}`;
            }                
            
            if(column === 'cost-column')
                totalCell.innerHTML = `<b>${formattedCost}</b>`; 
                
            if(column === 'clip-column')
                totalCell.innerHTML = `<b>${clipTotal.toFixed(2)}</b>`;
            if(column === 'xload-column')
                totalCell.innerHTML = `<b>${xloadTotal.toFixed(2)}</b>`;                 
            if(column === 'co2kwh-column')
                totalCell.innerHTML = `<b>${co2kwhTotal.toFixed(2)}</b>`;    
            if(column === 'co2kg-column')
                totalCell.innerHTML = `<b>${co2kgTotal.toFixed(2)}</b>`;                 
            
            totalsRow.appendChild(totalCell);
        
        });
        
        newTableBody.appendChild(totalsRow);
    }   
    
    let headOrFoot = "td";
    if(this.config.show_versions_top === true)
        headOrFoot = "th";    
    
    if (versionEntity !== undefined){

        const predbatVersion = hass.states[versionEntity].attributes.installed_version;
        const latestPredbatVersion = hass.states[versionEntity].attributes.latest_version;
        let lastUpdateHeaderRow = document.createElement('tr');
        let lastUpdateCell = document.createElement(headOrFoot);
        lastUpdateCell.classList.add('versionRow');
        lastUpdateCell.colSpan = columnsToReturn.length;
        let updateIcon = ``;
        if(predbatVersion !== latestPredbatVersion)
            updateIcon = `<ha-icon icon="mdi:download-circle-outline" style="--mdc-icon-size: 18px; margin-left: 4px;" title="Predbat version ${latestPredbatVersion} available"></ha-icon>`;
        lastUpdateCell.innerHTML = `Predbat Version: ${predbatVersion}${updateIcon}`;
        lastUpdateHeaderRow.appendChild(lastUpdateCell);
        
        if(this.config.show_versions_top === true)
            newTableHead.appendChild(lastUpdateHeaderRow);
        else
            newTableBody.appendChild(lastUpdateHeaderRow);
    }  
    
    if(this.config.show_tablecard_version === true){
        const version = hass.states["update.predbat_table_card_update"].attributes.installed_version;
        const latestVersion = hass.states["update.predbat_table_card_update"].attributes.latest_version;
        let lastUpdateHeaderRow = document.createElement('tr');
        let lastUpdateCell = document.createElement(headOrFoot);
        lastUpdateCell.classList.add('versionRow');
        lastUpdateCell.colSpan = columnsToReturn.length;
        let updateIcon = ``;
        if(version !== latestVersion)
            updateIcon = `<ha-icon icon="mdi:download-circle-outline" style="--mdc-icon-size: 18px; margin-left: 4px;" title="Predbat Table Card version ${latestVersion} available"></ha-icon>`;
        lastUpdateCell.innerHTML = `Predbat Table Card Version: ${version}${updateIcon}`;
        lastUpdateHeaderRow.appendChild(lastUpdateCell);
        newTableBody.appendChild(lastUpdateHeaderRow);
        if(this.config.show_versions_top === true)
            newTableHead.appendChild(lastUpdateHeaderRow);
        else
            newTableBody.appendChild(lastUpdateHeaderRow);        
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
    
    // This section of code is hiding the car and iboost columns if they have no value (and the user has set them as a column to return)
    
    if(this.config.hide_empty_columns === true){

        let carEmpty;
        let iBoostEmpty;
        
        if(columnsToReturn.includes("car-column"))
            carEmpty = true;
            
        if(columnsToReturn.includes("iboost-column"))
            iBoostEmpty = true;
            
        dataArray.forEach((item, index) => {
            
            if(item["car-column"] !== undefined)
                if(item["car-column"].value.length > 0 && item["car-column"].value !== "⚊")
                    carEmpty = false;
            
            if(item["iboost-column"] !== undefined)
                if (item["iboost-column"].value.length > 0 && item["iboost-column"].value !== "⚊")
                    iBoostEmpty = false;                    
        });
        
        //hide columns if empty
        let indexesToRemove = [];
        if(carEmpty === true)
            indexesToRemove.push(columnsToReturn.indexOf("car-column"));

        if(iBoostEmpty === true)
            indexesToRemove.push(columnsToReturn.indexOf("iboost-column"));
        
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
    
    
    theTable.appendChild(newTableHead);    
    theTable.appendChild(newTableBody);
    
    
    this.content.innerHTML = theTable.outerHTML;
    //this.content.innerHTML = `<button @click=${this.handleClick}>Hello world</button>`;

    const styleTag = document.createElement('style');
	styleTag.innerHTML = this.getStyles(this.getLightMode(hass.themes.darkMode));
	this.content.appendChild(styleTag);      
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
  
  handleClick() {
    console.log('hello world');
  }
  
  getCellTransformationRefactor(theItem, column, darkMode) {
      
      //
      // CELL TRANSFORMATION SETUP
      //
      
    let newCell = document.createElement('td');
    let newContent = "";
    
    let tooltip = ``;
    let cellAlert = ``;
    let cellSun = ``;
    let cellValue = ``;
    let cellArrow = ``;
    let cellSpecial = ``;
    
    //override fill empty cells
    let fillEmptyCells;
    if(this.config.fill_empty_cells === undefined)
        fillEmptyCells = true;
    else 
        fillEmptyCells = this.config.fill_empty_cells; 
        
    if(column === "time-column" && this.config.force_single_line === true)
        newCell.style.whiteSpace = "nowrap"; 
        
    newContent = theItem.value.replace(/[↘↗→☀]/g, '');
    newContent = this.adjustStatusFields(newContent);
  
    if(theItem.value.includes("↘")) {
        // include a down arrow
        cellArrow = `<ha-icon icon="mdi:arrow-down-thin" style="margin: 0 0 0 -5px; opacity:0.75;"></ha-icon>`;
        newCell.style.paddingRight = "0px";
    } else if (theItem.value.includes("↗")) {
        // include a up arrow
        cellArrow = `<ha-icon icon="mdi:arrow-up-thin" style="margin: 0 0 0 -5px; opacity:0.75;"></ha-icon>`;   
        newCell.style.paddingRight = "0px";
    } else if (theItem.value.includes("→")) {
        cellArrow = `<ha-icon icon="mdi:arrow-right-thin" style="margin: 0 0 0 -5px; opacity: 0.75;"></ha-icon>`;                 
        newCell.style.paddingRight = "0px";
    }       
    
    //    
    // END OF CELL TRANSFORMATION SETUP
    //
    
    //
    // OLD SKOOL COLUMN SETUP
    //
    
    if(this.config.old_skool === true || this.config.old_skool_columns !== undefined){
        if(this.config.old_skool === true || this.config.old_skool_columns.indexOf(column) >= 0){

            if(this.config.old_skool === true) {
                newCell.style.border = "1px solid white";
                newCell.style.backgroundColor = "#FFFFFF";
            }

            newCell.style.height = "22px";
            
            if(this.config.old_skool_columns.indexOf(column) >= 0){
                newCell.style.backgroundColor = theItem.color;
                if(darkMode)
                    newCell.style.color = "#000000";
            }

        }
    }
    
    //
    // END OF OLD SKOOL COLUMN SETUP
    //
    
    //
    // COLUMN SPECIFIC DATA SETUP
    //
    
    if(column === "pv-column" || column === "load-column"){
        
        if(theItem.value.includes("☀"))
            cellSun = `<ha-icon icon="mdi:white-balance-sunny" style="margin: 0; opacity: 0.5; --mdc-icon-size: 16px;"></ha-icon>`;
        
        //check for HTML Debug values
        if(newContent.includes("(") && newContent.includes(")")){
            const match = theItem.value.match(/(\d+(?:\.\d+)?)\s*\((\d+(?:\.\d+)?)\)/);
            let newVals = parseFloat(match[1]).toFixed(2) + " (" + parseFloat(match[2]).toFixed(2) + ")";
            newContent = newVals;
        }
        
        
        if(this.config.debug_columns !== undefined && newContent.length > 0) {// there are debug columns in the YAML
            
            if(!newContent.includes("(") && !newContent.includes(")")){ // there are debug columns in the YAML but HTML debug mode off
                newContent = parseFloat(newContent).toFixed(2);
            }
        
            if(this.config.debug_columns.indexOf(column) < 0) // the column isnt included
                newContent = parseFloat(newContent).toFixed(2);
        } else { // there are no debug columns in the YAML
            if(newContent.length > 0)
                newContent = parseFloat(newContent).toFixed(2);
        }
        
    }
    
    //
    // END OF COLUMN SPECIFIC DATA SETUP
    //
    
    //
    // COLUMN SPECIFIC DISPLAY SETUP    
    //
    
    if((theItem.value === "Both" || theItem.value === "Both-Idle" || theItem.value === "Both-Chg" || theItem.value === "Both-Dis" || theItem.value === "Both-Dis-Snail") && column === "state-column"){
        newCell.style.minWidth = "186px";
        if(this.config.use_friendly_states === true)
            newCell.style.minWidth = "276px";
        newCell.style.paddingLeft = "0px";
        newCell.style.paddingRight = "0px";
    }    
    
    //
    // END OF COLUMN SPECIFIC DISPLAY SETUP
    //
    
    cellValue = newContent;
    
    if(fillEmptyCells && (theItem.value.length === 0 || theItem.value === "⚊"))
        newCell.innerHTML = `<div class="iconContainer"><ha-icon icon="mdi:minus" style="margin: 0 2px; opacity: 0.25;"></ha-icon></div>`;
    else 
        newCell.innerHTML = `<div class="iconContainer" title="${tooltip}"><div style="margin: 0 2px;">${cellAlert}${cellSun}${cellValue}</div>${cellArrow}${cellSpecial}</div>`;
    return newCell;
  }
  
  getCellTransformation(theItem, column, darkMode) {
    
    let newCell = document.createElement('td');
    let newContent = "";
    
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
    
    
    if(column === "time-column" && this.config.force_single_line === true)
        newCell.style.whiteSpace = "nowrap";
        
    if(this.config.old_skool === true || this.config.old_skool_columns !== undefined && column !== "weather-column"){ // weather not supported in old skool
        
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
                        newContent = theItem.value;
                    } else {
                        // we need to remove the debug value from the string
                        if(column === "pv-column" || column === "load-column" || column === "limit-column")
                            if(column === "pv-column" || column === "load-column")
                                newContent = parseFloat(theItem.value).toFixed(2);
                            else 
                                newContent = parseFloat(theItem.value).toFixed(0);
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
                            friendlyText = friendlyText + "Idle";
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

        
    if(column !== "import-export-column" && column !== "weather-column"){
        newCell.style.color = theItem.color;
        if(theItem.value.replace(/\s/g, '').length === 0 || theItem.value === "0" || theItem.value === "⚊") {
            if(fillEmptyCells)
                newCell.innerHTML = `<div class="iconContainer"><ha-icon icon="mdi:minus" style="margin: 0 2px; opacity: 0.25;"></ha-icon></div>`;
        } else 
            newCell.innerHTML = `<div class="iconContainer">${theItem.value}</div>`;
    }
    
    if(column === "weather-column") {
        //console.log("Weather: ", theItem.value);
        
        newCell.style.color = theItem.color;
        
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

    if(column === "load-column" || column === "pv-column" || column == "car") {
        
            // set the PV or Load column to use the HTML debug 10% options if in the card YAML
            newContent = theItem.value;

            //check for HTML Debug values
            if(newContent.includes("(") && newContent.includes(")")){
                const match = theItem.value.match(/(\d+(?:\.\d+)?)\s*\((\d+(?:\.\d+)?)\)/);
                
                let newVals = parseFloat(match[1]).toFixed(2) + " (" + parseFloat(match[2]).toFixed(2) + ")";
                newContent = newVals;
            }
            
            if(this.config.debug_columns !== undefined) {// there are debug columns in the YAML
                if(this.config.debug_columns.indexOf(column) < 0)
                    newContent = parseFloat(newContent).toFixed(2);
            } else {
                newContent = parseFloat(newContent).toFixed(2);
            }
                    
        
            if(column === "pv-column"){
                if((theItem.value.includes("☀") || theItem.value.length > 0)  && !theItem.value.includes("⚊")) {
                    newContent = newContent.replace(/[☀]/g, '');
                    
                    let additionalIcon = "";

                    if(!this.isSmallScreen())
                        additionalIcon = '<ha-icon icon="mdi:white-balance-sunny" style="margin: 0; --mdc-icon-size: 20px; display: flex; align-items: center; justify-content: center;"></ha-icon>';
                    
                    newCell.innerHTML = `<div class="iconContainer">${additionalIcon} <div style="margin: 0 4px;">${newContent}</div></div>`;
                }
            } else {
                
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
            
            newCell.style.display = "flex";
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
           let priceStrings = this.getPricesFromPriceString(contentWithoutTags, hasBoldTags, hasItalicTags, true);
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
      
            // thePriceString = "-1.23 $ (-3.45)";
      
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
    const isToday = date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();
    
    // Format time
    const time = date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    // Build final string
    const timeStr = isToday ? `Today at ${time}` : `${date.toLocaleDateString('en-GB')} at ${time}`;
    
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
  if (!label || !forecastArray?.length) return null;

  const [labelDayStr, labelTimeStr] = label.split(' ');
  const [labelHour, labelMinute] = labelTimeStr.split(':').map(Number);

  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const targetWeekday = weekdayMap[labelDayStr];
  const now = new Date();
  const todayWeekday = now.getDay();
  const dayOffset = (targetWeekday - todayWeekday + 7) % 7;

  // Create label Date (local time)
  const labelDate = new Date(now);
  labelDate.setDate(now.getDate() + dayOffset);
  labelDate.setHours(labelHour, labelMinute, 0, 0);

  // Find the forecast whose datetime (converted to local) is the same hour as labelDate
  let bestMatch = null;
  let smallestDiff = Infinity;

  for (const forecast of forecastArray) {
    const forecastDate = new Date(forecast.datetime); // forecast datetime in UTC → Date() converts to local time

    // Compare rounded-down forecast time to label time
    const diffMs = Math.abs(forecastDate.getTime() - labelDate.getTime());
    const diffMinutes = diffMs / (1000 * 60);

    // Only match within ±30 minutes of the forecast hour block
    if (diffMinutes <= 30 && diffMinutes < smallestDiff) {
      bestMatch = forecast;
      smallestDiff = diffMinutes;
    }
  }

  return bestMatch || null;
}

  
  getColumnDescription(column) {
        const headerClassesObject = {
          'time-column': { description: "Time", smallDescription: "Time"},
          'import-column': { description: "Import", smallDescription: "Import" },
          'export-column': { description: "Export", smallDescription: "Export" },
          'state-column': { description: "State", smallDescription: "State" },
          'limit-column': { description: "Limit", smallDescription: "Limit" },
          'pv-column': { description: "PV kWh", smallDescription: "PV <br>kWh" },
          'load-column': { description: "Load kWh", smallDescription: "Load <br>kWh" },
          'soc-column': { description: "SoC", smallDescription: "SoC" },
          'clip-column': { description: "Clip kWh", smallDescription: "Clip <br>kWh" },          
          'car-column': { description: "Car kWh", smallDescription: "Car <br>kWh" },
          'iboost-column': { description: "iBoost kWh", smallDescription: "iBoost <br>kWh" },    
          'co2kg-column': {description: "CO2 kg", smallDescription: "CO2 kg" },
          'co2kwh-column': { description: "CO2 g/kWh", smallDescription: "CO2 g/kWh" },    
          'cost-column': { description: "Cost", smallDescription: "Cost" },
          'total-column': { description: "Total Cost", smallDescription: "Total <br>Cost" },
          'xload-column': { description: "XLoad kWh", smallDescription: "XLoad kWh" },
          'import-export-column': {description: "Import / Export", smallDescription: "Import / <br>Export" },
          'net-power-column': {description: "Net kWh", smallDescription: "Net <br>kWh" }, 
          'weather-column': {description: "Weather", smallDescription: "Weather" }
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
                    /*
                    if(columnHeaderTitle.includes("PV KWH (10%)")) {
                        headerClassesArray.splice(checkIndex-1, 0, "pv10-column");
                    }    
                    
                    if(columnHeaderTitle.includes("LOAD KWH (10%)")) {
                        headerClassesArray.splice(checkIndex-1, 0, "load10-column");
                    }  */
                    
                });
                
            }
            
            if (index > firstRowData && index < (trElements.length -1)) {

                // helps with the math when columns count and colspan at work
                let countDifference = Object.keys(headerClassesArray).length - tdElements.length;
                
                let newTRObject = {};
                
                // Loop through each <td> element inside the current <tr>
                tdElements.forEach((tdElement, tdIndex) => {
                    
                    let bgColor = tdElement.getAttribute('bgcolor'); 
                    
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
                    let weatherColor = "var(--primary-text-color)"; // #F18261
                    const match = this.findForecastForLabel(newTRObject["time-column"].value, this.forecast);
                    if(match !== undefined && match !== null){
                        let matchStore = match;
                        
                        if(this.isLabelDuringNight(newTRObject["time-column"].value, this._hass) && match.condition === "partlycloudy")
                            matchStore.condition = "partlycloudynight";
                        
                        const weatherEntity = this._hass.states[this.config.weather_entity];
                        const tempUnit = weatherEntity?.attributes?.temperature_unit || this._hass.config.unit_system.temperature;
                        
                        if(tempUnit === "°F" && match.temperature >= 77)
                            weatherColor = "rgb(220, 67, 20)";
                        
                        if(tempUnit === "°C" && match.temperature >= 25)
                            weatherColor = "rgb(220, 67, 20)";
                            
                        if(tempUnit === "°C" && match.temperature <= 0)
                            weatherColor = "rgb(31, 136, 207)";
                            
                        if(tempUnit === "°F" && match.temperature <= 32)
                            weatherColor = "rgb(31, 136, 207)";
                        
                        newTRObject["weather-column"] = {"value": matchStore, "color": weatherColor};
                    } else 
                        newTRObject["weather-column"] = {"value": null, "color": null};
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
	let boldTextDisplay, dayTotalFontColour, dayTotalBackgroundColour, totalBackgroundColour, dividerColour;
	
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
    	dayTotalFontColour = "#FFFFFF";
    	dayTotalBackgroundColour = evenColour;
    	totalBackgroundColour = oddColour;
    	
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
    	dayTotalFontColour = "#000000";
 	    dayTotalBackgroundColour = "var(--light-primary-color)";
    	totalBackgroundColour = tableHeaderBackgroundColour; 
    	dividerColour = "var(--primary-color)";
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
	    
	let fontSize = "14";
	//use yaml font size if exists
	if(this.config.font_size !== undefined){
	    fontSize = this.config.font_size;
	}
	    
		return `
    .card-content table {
      /* Your styles for the table inside .card-content */
      border: 2px solid ${evenColour};
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
        height: 24px;
        color: ${tableHeaderFontColour};
        text-align: center; !important
    }
    
    .totalRow {
        background-color: ${totalBackgroundColour} !important; 
        height: 24px;
        color: ${tableHeaderFontColour};
        text-align: center; !important
    }    
    
    .dayTotalRow {
        background-color: ${dayTotalBackgroundColour} !important; 
        height: 24px;
        color: ${dayTotalFontColour};
        text-align: center !important;
    }        
    
    .card-content table thead tr .lastUpdateRow {
        height: 24px;
        font-weight: normal;
        background-color: ${tableHeaderBackgroundColour};
    }
    
    .versionRow {
        height: 24px;
        font-weight: normal;
        background-color: ${tableHeaderBackgroundColour}; 
        color: ${tableHeaderFontColour};
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
