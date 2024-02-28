class PredbatTableCard extends HTMLElement {
  // Whenever the state changes, a new `hass` object is set. Use this to
  // update your content.
  set hass(hass) {
    // Initialize the content if it's not there yet.
    if (!this.content) {
      this.innerHTML = `
        <ha-card>
          <div class="card-content"></div>
        </ha-card>
      `;
      this.content = this.querySelector("div");
    }

    const entityId = this.config.entity;
    const state = hass.states[entityId];
    const stateStr = state ? state.state : "unavailable";
    const columnsToReturn = this.config.columns;

    let rawHTML = hass.states[entityId].attributes.html;

    const lastUpdated = this.getLastUpdatedFromHTML(rawHTML);
    const dataArray = this.getArrayDataFromHTML(rawHTML); 
    let theTable = document.createElement('table');
    
    //set out the table header row
    
    let newTableHead = document.createElement('thead');
    
    let newHeaderRow = document.createElement('tr');
    newTableHead.classList.add('topHeader');   
        
    //create the header rows
    columnsToReturn.forEach((column, index) => {
        let newColumn = document.createElement('th');
        newColumn.textContent = this.getColumnDescription(column);
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
            let newColumn = this.getCellTransformation(item[column], column);
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
                        newCell.style.backgroundColor = "#e1e1e1";
                        newCell.style.height = "1px";
                        newCell.style.opacity = 0.3;
                        dividerRow.appendChild(newCell);
                    }
                newTableBody.appendChild(dividerRow);
            }
        }
    });
    
    theTable.appendChild(newTableBody);
    
    this.content.innerHTML = theTable.outerHTML;
    
    const styleTag = document.createElement('style')
	styleTag.innerHTML = this.getStyles()
	this.content.appendChild(styleTag);
    
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
  
  getCellTransformation(theItem, column) {
    
    let newCell = document.createElement('td');
    let newContent = "";
    
    if(column !== "import-export-column"){
        newCell.style.color = theItem.color;
        if(theItem.value.replace(/\s/g, '').length === 0) {
            if(this.config.fill_empty_cells)
                newCell.innerHTML = `<div class="iconContainer"><ha-icon icon="mdi:minus" style="margin: 0 2px; opacity: 0.25;"></ha-icon></div>`;
        } else 
            newCell.textContent = theItem.value;
    }

    if(column === "load-column" || column === "pv-column") {
        
            if(column === "pv-column"){
                if(theItem.value.length > 0) {
                    newContent = theItem.value.replace(/[☀]/g, '');
                    let additionalIcon = "";
                    if(theItem.value.includes("☀")) {
                        additionalIcon = '<ha-icon icon="mdi:white-balance-sunny" style="margin: 0 4px;"></ha-icon>';
                    }
                    newCell.innerHTML = `<div class="iconContainer">${additionalIcon} <div style="margin: 0 4px;">${newContent}</div></div>`;
                }
            } else {
                newCell.textContent = theItem.value;
            }

        
    } else if(column === "time-column" || column === "total-column"){
          
        newCell.style.color = "#FFFFFF";
        newCell.textContent = theItem.value;
        
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
                    if(this.config.fill_empty_cells)
                        additionalArrow = '<ha-icon icon="mdi:minus" style="margin: 0 2px; opacity: 0.25;"></ha-icon>';                 
                }
                
                if(column === "soc-column") {
                    newContent += "%";
                }

          newCell.innerHTML = `<div class="iconContainer"><div style="margin: 0 2px;">${newContent}</div>${additionalArrow}</div>`;
      
    } else if(column === "state-column"){

          newContent = theItem.value.replace(/[↘↗→]/g, '');
         
            let additionalArrow = "";
            newCell.setAttribute('style', 'color: var(--energy-battery-out-color)');
                if(theItem.value === "↘" || theItem.value === "↗" || theItem.value === "→"){
                    additionalArrow = '<ha-icon icon="mdi:home-lightning-bolt" style=""></ha-icon>';
                    newCell.setAttribute('style', 'color: white');
                } else if(newContent === "Discharge"){
                        // use force discharge icon
                        additionalArrow = '<ha-icon icon="mdi:battery-minus" style=""></ha-icon>';
                } else if(newContent === "FreezeDis" || newContent === "FreezeChrg" || newContent === "HoldChrg"){
                        // use force discharge icon
                        additionalArrow = '<ha-icon icon="mdi:battery-lock" style=""></ha-icon>';
                        newCell.setAttribute('style', 'color: white');
                } else if(newContent === "Charge"){
                    additionalArrow = '<ha-icon icon="mdi:battery-charging-100"></ha-icon>';
                    newCell.setAttribute('style', 'color: var(--energy-battery-in-color)');                    
                } else if(newContent === "Both"){
                    additionalArrow = '<ha-icon icon="mdi:battery-charging-100" style="color: var(--energy-battery-in-color);"></ha-icon><ha-icon icon="mdi:battery-minus" style="color: var(--energy-battery-out-color);"></ha-icon>';
                }

          newCell.innerHTML = `${additionalArrow}`;
          
    } else if(column === "limit-column"){

        if(theItem.value.replace(/\s/g, '').length > 0){

            newCell.innerHTML = `<svg version="1.1" width="42" height="42" id="limitSVG">
                            <circle cx="21" cy="21" r="14" stroke="#2a3240" stroke-width="2" fill="#e1e1e1"/>
                            <text x="21" y="22" dominant-baseline="middle" text-anchor="middle" fill="#2a3240" font-size="11"} font-weight="bold">${theItem.value}</text>
                        </svg>`;
        
        }
        
    } else if (column === "import-column" || column === "export-column") {
            
            newCell.innerHTML = '<div class="iconContainer">' + this.getTransformedCostToPill(theItem) + '</div>';

    } else if(column === "import-export-column"){
          
            
            let newPills = "";
            theItem.forEach((item, index) => {
                newPills += '<div style="height: 26px; align-items: center;">' + this.getTransformedCostToPill(item) + '</div>';
            });
            
            newCell.innerHTML = '<div class="multiPillContainer">' + newPills + '</div>';

    }  
    

      return newCell;
  }
  
  getTransformedCostToPill(theItem){
      
            const hasBoldTags = /<b>.*?<\/b>/.test(theItem.value);
            const hasItalicTags = /<i>.*?<\/i>/.test(theItem.value);
            
            let contentWithoutTags;
            let boldAttribute = "";
            let boldLozenge = "";
            if (hasBoldTags || hasItalicTags) {
                contentWithoutTags = theItem.value.replace(/<b>(.*?)<\/b>/g, '$1');
                contentWithoutTags = contentWithoutTags.replace(/<i>(.*?)<\/i>/g, '$1');
                if(hasBoldTags){
                    boldAttribute = ' font-weight="bold"';
                    let borderLozengeColor = this.getDarkenHexColor(theItem.color, 60);
                    boldLozenge = ' stroke="'+ borderLozengeColor +'" stroke-width="2"';
                }
            } else {
                contentWithoutTags = theItem.value;
            }
            
            // Measure the width of the text in pixels
            let textWidth = contentWithoutTags.length * 8.5;// Adjust the factor based on your font and size
            
            const textColor = this.getDarkenHexColor(theItem.color, 60);
            
            let svgLozenge = `<svg version="1.1" width=${textWidth} height="24" style="margin-top: 0px;">
                                <rect x="4" y="2" width="${textWidth-10}" height="20" fill="${theItem.color}"${boldLozenge} ry="10" rx="10"/>
                                <text x="48%" y="13" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-size="11"${boldAttribute}>${contentWithoutTags}</text>
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
                    lastUpdate = new Date(dateTimeString);
 
              });
          }
      });
      
      return lastUpdate;
  }
  
  getColumnDescription(column) {
        const headerClassesObject = {
          'time-column': { description: "Time" },
          'import-column': { description: "Import" },
          'export-column': { description: "Export" },
          'state-column': { description: "Status" },
          'limit-column': { description: "Limit" },
          'pv-column': { description: "PV kWh" },
          'load-column': { description: "Load kWh" },
          'soc-column': { description: "SOC %" },
          'car-column': { description: "Car kWh" },
          'cost-column': { description: "Cost" },
          'total-column': { description: "Total Cost" },
          'import-export-column': {description: "Import \n/ Export" }
        };
        
        if (headerClassesObject.hasOwnProperty(column)) {
            // Return the description associated with the key
            return headerClassesObject[column].description;
          } else {
            // If the key does not exist, return a default description or handle the error as needed
            return "Description not found";
          }
  }
  
  getArrayDataFromHTML(html) {
      
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
                tdElements.forEach(tdElement => {
                    let columnHeaderTitle = tdElement.innerHTML.toUpperCase();
                    if (columnHeaderTitle.includes("CAR")) {
                        headerClassesArray.splice(7, 0, "car-column");
                    }
                });
                
            }
            
            if (index > 1) {

                // helps with the math when columns count and colspan at work
                let countDifference = Object.keys(headerClassesArray).length - tdElements.length;
                
                let newTRObject = {};
                
                // Loop through each <td> element inside the current <tr>
                tdElements.forEach((tdElement, tdIndex) => {
                    
                    const bgColor = tdElement.getAttribute('bgcolor'); 
                    
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
  
	getStyles() {
	   
	//defaults 
	let tableWidth = 100;
	let oddColour = "#181f2a";
	let evenColour = "#2a3240";
	let maxHeight = "42px";
	
	//use yaml width if exists
	if(this.config.table_width !== undefined){
	    tableWidth = this.config.table_width;
	}
	
	if(this.config.odd_row_colour !== undefined){
	    oddColour = this.config.odd_row_colour;
	}
	
	if(this.config.even_row_colour !== undefined){
	    evenColour = this.config.even_row_colour;
	}
	
	if(this.config.columns !== undefined && this.config.columns.indexOf("import-export-column") >= 0){
	    maxHeight = "54px";
	}
	   
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
    
    .topHeader {
        background-color: ${evenColour};
        height: 60px;
        color: #8a919e;
    }
    
    .daySplitter {
        height: 1px;
        background-color: #e1e1e1;
    }    
    
    .card-content tbody tr td {
        
        height: ${maxHeight};
        align-items: center;
        width: 60px;
        border: 0;
        text-align: center;
        white-space: nowrap;
        color: #FFFFFF;
    }
    
    .card-content tbody tr td:nth-child(1) {
      max-width: 40px; /* Adjust the maximum width as needed */
      white-space: normal;
    }
    
    .card-content tbody tr td:nth-child(4) {
    width: 100px;
    }
    
    #limitSVG {
      position: relative;
      top: 2px;
    }
    
    .iconContainer {
      display: flex;
      align-items: center; /* Center content vertically */
      justify-content: center; /* Center content horizontally */
      height: 42px; /* Set height of table cell */
    }
    
    .multiPillContainer {
      align-items: center; /* Center content vertically */
      justify-content: center; /* Center content horizontally */
      height: 54px; /* Set height of table cell */
      margin-top: 4px;
    }    
    `;
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
