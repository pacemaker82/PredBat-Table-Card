class PredbatTableCard extends HTMLElement {
  // Whenever the state changes, a new `hass` object is set. Use this to
  // update your content.
    static get properties() {
        return {
            _config: {},
            _hass: {},
        };
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
        this.processAndRender(hass);
    } else {
        const oldEntityUpdateTime = oldHass.states[entityId].last_updated;
        const newEntityUpdateTime = hass.states[entityId].last_updated;
        
        //only render new HTML if the entity actually changed
        if(oldEntityUpdateTime !== newEntityUpdateTime)
            this.processAndRender(hass);        
    }
    

  }
  
  processAndRender(hass){
    const entityId = this.config.entity;
    const state = hass.states[entityId];
    const stateStr = state ? state.state : "unavailable";
    const columnsToReturn = this.config.columns;

    let rawHTML = hass.states[entityId].attributes.html;

    console.log(hass.states[entityId].last_updated);

    const lastUpdated = this.getLastUpdatedFromHTML(rawHTML);
    const dataArray = this.getArrayDataFromHTML(rawHTML, hass.themes.darkMode); 
    let theTable = document.createElement('table');
    theTable.setAttribute('id', 'predbat-table');
    theTable.setAttribute('cellpadding', '0px');
    
    //set out the table header row
    
    let newTableHead = document.createElement('thead');
    
    // Create an optional Last Updated Table Header Row
    if(this.config.hide_last_update !== true) {
    
        let lastUpdateHeaderRow = document.createElement('tr');
        let lastUpdateCell = document.createElement('th');
        lastUpdateCell.classList.add('lastUpdateRow');
        lastUpdateCell.colSpan = columnsToReturn.length;
        lastUpdateCell.innerHTML = `<b>Plan Last Updated:</b> ${lastUpdated}`;
        lastUpdateHeaderRow.appendChild(lastUpdateCell);
        newTableHead.appendChild(lastUpdateHeaderRow);
    
    }
    
    let newHeaderRow = document.createElement('tr');
    newTableHead.classList.add('topHeader');   
        
    //create the header rows
    columnsToReturn.forEach((column, index) => {
        let newColumn = document.createElement('th');
        newColumn.innerHTML = this.getColumnDescription(column);
        newHeaderRow.appendChild(newColumn);
    });
        
    newTableHead.appendChild(newHeaderRow);
    theTable.appendChild(newTableHead);
        
    // set out the data rows
    let newTableBody = document.createElement('tbody');
    
    // create the data rows
    dataArray.forEach((item, index) => {
        
        let newRow = document.createElement('tr');
        
        let isMidnight = false;
        columnsToReturn.forEach((column, index) => { // Use arrow function here
            if(item["time-column"].value.includes("23:30"))
                isMidnight = true;
            let newColumn = this.getCellTransformation(item[column], column, hass.themes.darkMode);
            newRow.appendChild(newColumn);
        });
        
        newTableBody.appendChild(newRow);
        
        if(isMidnight){
            
            // add two rows because otherwise it messes with the alternate row scheme
            for (let i = 0; i < 2; i++) {
                let dividerRow = document.createElement('tr');
                dividerRow.classList.add('daySplitter');
                    for(let j = 0; j < columnsToReturn.length; j++) {
                        let newCell = document.createElement('td');
                        
                        if(this.getLightMode(hass.themes.darkMode)){
                            newCell.style.backgroundColor = "#e1e1e1"; 
                            newCell.style.opacity = 0.4; 
                        } else {
                            // light mode
                            newCell.style.backgroundColor = "#2a3240"; 
                            newCell.style.opacity = 0.75; 
                        }
                        
                        newCell.style.height = "1px";
                        dividerRow.appendChild(newCell);
                    }
                newTableBody.appendChild(dividerRow);
            }
        }
    });
    
    theTable.appendChild(newTableBody);
    
    this.content.innerHTML = theTable.outerHTML;
    const styleTag = document.createElement('style');
	styleTag.innerHTML = this.getStyles(this.getLightMode(hass.themes.darkMode));
	this.content.appendChild(styleTag);      
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

  // The user supplied configuration. Throw an exception and Home Assistant
  // will render an error card.
  setConfig(config) {
    if (!config.entity) {
      throw new Error("You need to set the predbat entity");
    }
    if (!config.columns) {
      throw new Error("You need to define a list of columns (see docs)");
    }
    
    this.config = config;

  }

  // The height of your card. Home Assistant uses this to automatically
  // distribute all cards over the available columns.
  getCardSize() {
    return 3;
  }
  
  getCellTransformation(theItem, column, darkMode) {
    
    let newCell = document.createElement('td');
    let newContent = "";
    
    //override fill empty cells
    let fillEmptyCells;
    if(this.config.fill_empty_cells === undefined)
        fillEmptyCells = true;
    else 
        fillEmptyCells = this.config.fill_empty_cells;
      
    //  
    //Set the table up for people that like the Trefor style
    //
    
    if(column !== "import-export-column"){
    
        if(theItem.value.replace(/\s/g, '').length === 0) {
            
        }
    }
    
    if(this.config.old_skool === true){
        newCell.style.border = "1px solid white";
        newCell.style.backgroundColor = "#FFFFFF";
        newCell.style.color = "#000000";
        newCell.style.height = "22px";
        
        if(theItem.value === "Both" && column === "state-column"){
            
            newCell.style.minWidth = "150px";
            newCell.innerHTML = `<div style="width: 100%; height: 100%;">
            <div style='background-color:#3AEE85; width: 50%; height: 100%; float: left; display: flex; align-items: center; justify-content: center;'>Charge↗</div>
            <div style='background-color:#FFFF00; width: 50%; height: 100%; float: left; display: flex; align-items: center; justify-content: center;'>Discharge↘</div>
            </div>`;
        
        } else if(column === "import-export-column"){
            
            theItem.forEach((item, index) => {
                newContent += `<div style="display: flex; align-items: center; justify-content: center; height: 50%; background-color: ${item.color}">${item.value}</div>`;
            });
            
            newCell.innerHTML = newContent;
            
        } else {
            newCell.style.backgroundColor = theItem.color;
            if(theItem.value.replace(/\s/g, '').length === 0) {
                if(fillEmptyCells)
                    newCell.innerHTML = `<div class="iconContainer"><ha-icon icon="mdi:minus" style="margin: 0 2px; opacity: 0.25;"></ha-icon></div>`;
            } else {
                newCell.innerHTML = theItem.value;
            }
        }
    
        return newCell;
    }    

        
    if(column !== "import-export-column"){
        newCell.style.color = theItem.color;
        if(theItem.value.replace(/\s/g, '').length === 0) {
            if(fillEmptyCells)
                newCell.innerHTML = `<div class="iconContainer"><ha-icon icon="mdi:minus" style="margin: 0 2px; opacity: 0.25;"></ha-icon></div>`;
        } else 
            newCell.innerHTML = `<div class="iconContainer">${theItem.value}</div>`;
    }
    


    if(column === "load-column" || column === "pv-column" || column == "car") {
        
            if(column === "pv-column"){
                if(theItem.value.length > 0) {
                    newContent = theItem.value.replace(/[☀]/g, '');
                    newContent = parseFloat(newContent).toFixed(2);
                    let additionalIcon = "";

                    additionalIcon = '<ha-icon icon="mdi:white-balance-sunny" style="margin: 0 4px;"></ha-icon>';
                    
                    newCell.innerHTML = `<div class="iconContainer">${additionalIcon} <div style="margin: 0 4px;">${newContent}</div></div>`;
                }
            } else {
                newContent = theItem.value;
                newContent = parseFloat(newContent).toFixed(2);
                newCell.innerHTML = `<div class="iconContainer">${newContent}</div>`;
            }

        
    } else if(column === "time-column" || column === "total-column"){
          
        newCell.style.color = theItem.color;
        newCell.style.textShadow = "none";
        
        newCell.innerHTML = `<div class="iconContainer">${theItem.value}</div>`;
        
    } else if(column === "soc-column" || column === "cost-column"){

          newContent = theItem.value.replace(/[↘↗→]/g, '');
          
            let additionalArrow = "";

                if(theItem.value.includes("↘")) {
                    // include a down arrow
                    additionalArrow = '<ha-icon icon="mdi:arrow-down-thin" style="margin: 0 2px;"></ha-icon>';
                } else if (theItem.value.includes("↗")) {
                    // include a down arrow
                    additionalArrow = '<ha-icon icon="mdi:arrow-up-thin" style="margin: 0 2px;"></ha-icon>';                    
                } else {
                    if(fillEmptyCells)
                        additionalArrow = '<ha-icon icon="mdi:minus" style="margin: 0 2px; opacity: 0.25;"></ha-icon>';                 
                }
                
                if(column === "soc-column") {
                    newContent += "%";
                }

          newCell.innerHTML = `<div class="iconContainer"><div style="margin: 0 2px;">${newContent}</div>${additionalArrow}</div>`;
      
    } else if(column === "state-column"){
        

          newContent = theItem.value.replace(/[↘↗→ⅎ]/g, '').trim();
        
         
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
                } else if(newContent === "Discharge"){
                        // use force discharge icon
                        let tooltip = "Planned Discharge";
                        if(theItem.value.includes("ⅎ"))
                            tooltip = "Manual Forced Discharge";                        

                        additionalArrow = `<ha-icon icon="mdi:battery-minus" style="" title="${tooltip}" class="icons" style="--mdc-icon-size: 22px;"></ha-icon>`;
                        if(theItem.value.includes("ⅎ"))
                            additionalArrow += `<ha-icon icon="mdi:hand-back-right-outline" title="${tooltip}" style="--mdc-icon-size: 22px;"></ha-icon>`;
                        
                } else if(newContent === "FreezeDis" || newContent === "FreezeChrg" || newContent === "HoldChrg" || newContent === "NoCharge"){
                        // use force discharge icon
                        additionalArrow = '<ha-icon icon="mdi:battery-lock" style="" title="Charging Paused"></ha-icon>';
                        newCell.setAttribute('style', `color: ${theItem.color}`);
                } else if(newContent === "Charge"){
                    let tooltip = "Planned Charge";
                    
                    if(theItem.value.includes("ⅎ"))
                        tooltip = "Manual Forced Charge";
                    
                    additionalArrow = `<ha-icon icon="mdi:battery-charging-100" title="${tooltip}" style="--mdc-icon-size: 22px;"></ha-icon>`;
                    if(theItem.value.includes("ⅎ"))
                        additionalArrow += `<ha-icon icon="mdi:hand-back-right-outline" title="${tooltip}" style="--mdc-icon-size: 22px;"></ha-icon>`;
                    newCell.setAttribute('style', 'color: var(--energy-battery-in-color)');                    
                } else if(newContent === "Both"){
                    additionalArrow = '<ha-icon icon="mdi:battery-charging-100" style="color: var(--energy-battery-in-color); --mdc-icon-size: 22px;" title="Planned Charge" class="icons"></ha-icon><ha-icon icon="mdi:battery-minus" style="color: var(--energy-battery-out-color);" title="Planned Discharge" class="icons"></ha-icon>';
                }

          newCell.innerHTML = `<div class="iconContainer">${additionalArrow}</div>`;
          
    } else if(column === "limit-column"){

        if(theItem.value.replace(/\s/g, '').length > 0){

            newCell.innerHTML = `
            
                <div class="iconContainer">
                    <svg version="1.1" width="34" height="34" id="limitSVG">
                    <circle cx="17" cy="17" r="11" stroke="#2a3240" stroke-width="2" fill="#e1e1e1"/>
                    <text class="pill" x="17" y="18" dominant-baseline="middle" text-anchor="middle" fill="#2a3240" font-size="10"} font-weight="bold">${theItem.value}</text>
                    </svg>
                </div>`;
        
        }
        
    } else if (column === "import-column" || column === "export-column") {
        
        // manage debug price pills appropriately
        // debug_prices_only | true | false
        if (theItem.value.includes("(") || theItem.value.includes(")")) {
            // if debug prices are present based on ( ) search
            
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
  
  getPricesFromPriceString(thePriceString, hasBoldTags, hasItalicTags, debugOnly){
      
//            ? ⅆ - Rate that has been modified based on input_number.predbat_metric_future_rate_offset_import or input_number.predbat_metric_future_rate_offset_export
//            ? ⚖ - Rate that has been estimated using future rate estimation data (e.g. Nordpool)
//            = - Rate that has been overridden by the users apps.yaml
//            ± - Rate that has been adjusted with a rate offset in the users apps.yaml
//            $ - Rate that has been adjusted for an Octopus Saving session
//            ? - Rate that has not yet been defined and the previous days data was used instead      
      
            const testRegex = /(\d+\.\d+)\D+(\d+\.\d+)/;
            //const testString = "1.23 (3.45)";
            const testMatches = thePriceString.match(testRegex);
            const strippedString = thePriceString.replace(testMatches[1], '').replace(testMatches[2], '').replace(/[()]/g, '').trim();

            let firstPillString; 
            let secondPillString;
            
            if(debugOnly){
                firstPillString = testMatches[1];
                secondPillString = testMatches[2] + strippedString;                
            } else {
                firstPillString = testMatches[1] + strippedString;
                secondPillString = testMatches[2];
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
                    boldLozenge = ' stroke="'+ borderLozengeColor +'" stroke-width="2"';
                } 
                
                if(hasItalicTags){
                    italicAttribute = ' font-style="italic"';
                    boldLozenge = ' stroke="'+ borderLozengeColor +'" stroke-width="1"';
                }
                
                if(hasItalicTags && hasBoldTags)
                    boldLozenge = ' stroke="'+ borderLozengeColor +'" stroke-width="2"';
                
            } else {
                contentWithoutTags = theItem.value;
                boldLozenge = ' stroke="'+ borderLozengeColor +'" stroke-width="1"';
            }
            
            // Measure the width of the text in pixels
            
            let textWidth = contentWithoutTags.length * 8.5;// Adjust the factor based on your font and size
            if(textWidth < 65){
                textWidth = 65;
            }
            
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
  
  getLastUpdatedFromHTML(html) {
    // Create a dummy element to manipulate the HTML
      const dummyElement = document.createElement('div');
      dummyElement.innerHTML = html;
      const trElements = dummyElement.querySelectorAll('tbody tr');
      
      let lastUpdate;
      trElements.forEach((trElement, index) => {
          if(index === 0){
              const tdElements = trElement.querySelectorAll('td');
              tdElements.forEach(tdElement => {
                    //console.log("table update: " + tdElement.innerHTML);
                    const dateTimeString = tdElement.innerHTML.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)[0];

                    // Create a JavaScript Date object from the extracted date/time string
                    const date = new Date(dateTimeString);
                    const today = new Date();

                    const options = { hour: 'numeric', minute: '2-digit', hour12: true };
                    const timeString = date.toLocaleTimeString('en-US', options);
                
                    if (date.toDateString() === today.toDateString()) {
                        lastUpdate = `Today at ${timeString}`;
                    } else {
                        // Format for other days if needed
                        lastUpdate = date.toDateString(); // Example format
                    }
                    
              });
          }
      });
      return lastUpdate;
      
  }
  
  getColumnDescription(column) {
        const headerClassesObject = {
          'time-column': { description: "Time", smallDescription: "Time"},
          'import-column': { description: "Import", smallDescription: "Import" },
          'export-column': { description: "Export", smallDescription: "Export" },
          'state-column': { description: "Status", smallDescription: "Status" },
          'limit-column': { description: "Limit", smallDescription: "Limit" },
          'pv-column': { description: "PV kWh", smallDescription: "PV <br>kWh" },
          'load-column': { description: "Load kWh", smallDescription: "Load <br>kWh" },
          'soc-column': { description: "SOC", smallDescription: "SOC" },
          'car-column': { description: "Car kWh", smallDescription: "Car <br>kWh" },
          'iboost-column': { description: "iBoost kWh", smallDescription: "iBoost <br>kWh" },          
          'cost-column': { description: "Cost", smallDescription: "Cost" },
          'total-column': { description: "Total Cost", smallDescription: "Total <br>Cost" },
          'import-export-column': {description: "Import / Export", smallDescription: "Import / <br>Export" }
        };
        
        if (headerClassesObject.hasOwnProperty(column)) {
            // Return the description associated with the key
            
            const screenWidth = window.innerWidth;
            // predbat-card-content
            // const tableWidth = document.getElementById('predbat-table').offsetWidth;
            // const cardContentWidth = document.getElementById('predbat-card-content').offsetWidth;
            
            if(screenWidth < 815){
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
        trElements.forEach((trElement, index) => {
        
        const tdElements = trElement.querySelectorAll('td');
            
            if (index === 1) {

                //check for car column in the first row and add new car-column class to array in position 7
                tdElements.forEach((tdElement, checkIndex) => {
                    let columnHeaderTitle = tdElement.innerHTML.toUpperCase();
                    if (columnHeaderTitle.includes("CAR")) {
                        
                        headerClassesArray.splice(checkIndex-1, 0, "car-column");
                    }
                    if(columnHeaderTitle.includes("IBOOST")) {
                        headerClassesArray.splice(checkIndex-1, 0, "iboost-column");
                    }
                });
                
            }
            
            if (index > 1) {

                // helps with the math when columns count and colspan at work
                let countDifference = Object.keys(headerClassesArray).length - tdElements.length;
                
                let newTRObject = {};
                
                // Loop through each <td> element inside the current <tr>
                tdElements.forEach((tdElement, tdIndex) => {
                    
                    let bgColor = tdElement.getAttribute('bgcolor'); 
                    
                    if(bgColor.toUpperCase() === "#FFFFFF" && tdIndex != 1 && tdIndex != 2 && this.config.old_skool !== true && this.getLightMode(hassDarkMode) !== true)
                            bgColor = "var(--primary-text-color)";
                            
                    if(this.getLightMode(hassDarkMode) === false && this.config.old_skool !== true){
                        
                        // light mode active so adjust the colours from trefor
                        bgColor = this.getDarkenHexColor(bgColor, 30);
                        
                    }
                    

                    
                    if(tdIndex ===2){
                        currentExportRate = tdElement.innerHTML;
                        currentExportColor = bgColor;
                    }
                    
                    if(tdIndex <= 2){
                        newTRObject[headerClassesArray[tdIndex]] = {"value": tdElement.innerHTML, "color": bgColor};
                    } else {
                        //2
                        if(countDifference != 0){
                            newTRObject[headerClassesArray[tdIndex+countDifference]] = {"value": tdElement.innerHTML, "color": bgColor};
                        } else {
                            newTRObject[headerClassesArray[tdIndex]] = {"value": tdElement.innerHTML, "color": bgColor};
                        }
                    }
                    
                    
                    
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
                    newTRObject[headerClassesArray[3]] = {"value": "Both", "color": "green"};
                }
                
                newTRObject["import-export-column"] = [newTRObject[headerClassesArray[1]], newTRObject[headerClassesArray[2]]];
                
                newDataObject.push(newTRObject);
            }
            
        });
    
      // Get the modified HTML
      return newDataObject;
    }
  
	getStyles(isDarkMode) {
	   
	//defaults 
	let tableWidth = 100;
	let oddColour;
	let evenColour;
	let maxHeight = "30px";
	let tableHeaderFontColour;
	let tableHeaderBackgroundColour;
	let tableHeaderColumnsBackgroundColour;
	let boldTextDisplay;
	
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
	    maxHeight = "22px";
	    
		return `
    .card-content table {
      /* Your styles for the table inside .card-content */
      border: 2px solid ${evenColour};
      width: ${tableWidth}%;
      border-spacing: 0px;
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
    
    .card-content table thead tr .lastUpdateRow {
        height: 24px;
        font-weight: normal;
        background-color: ${tableHeaderBackgroundColour};
    }
    
    
    .card-content table thead tr .topHeader {
        background-color: ${tableHeaderColumnsBackgroundColour};
    }

    
    .daySplitter {
        height: 1px;
        background-color: #e1e1e1;
    }    
    
    .card-content table tbody tr td {
        
        height: ${maxHeight};
        vertical-align: middle;
        align-items: center;
       -- width: 60px;
        border: 0;
        text-align: center;
        white-space: nowrap;
        */text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.7);*/
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
							preview: false,
							description: "Predbat Card showing the plan table in a nicer format"
						});
