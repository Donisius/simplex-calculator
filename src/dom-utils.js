/**
 * Generates an html table representation of the given tableau.
 *
 * @param body Table body.
 * @param headers Table headers.
 * @param caption Table caption.
 * @param pivotPosition Indicates which position to highlight on the table.
 * @param phase Phase `1` or phase `2` of the simplex method. In phase 1 the function highlights the
 * row containing the original cost function.
 */
export const generateTable = (body, headers, caption = "Tableau", pivotPosition = { x: null, y: null }, phase) => {
	const anchor = document.getElementById("tableau-anchor");

	const table = document.createElement("table");
	table.className = "tableau";
	const tableBody = document.createElement("tbody");
	const headerRow = document.createElement("tr");

	headers.forEach(header => {
		const tableHeader = document.createElement("th");
		tableHeader.appendChild(document.createTextNode(header));
		headerRow.appendChild(tableHeader);
	});

	tableBody.appendChild(headerRow);

	body.forEach((row, rowIndex) => {
		const tableRow = document.createElement("tr");
		row.forEach((datapoint, columnIndex) => {
			const tableDatapoint = document.createElement("td");
			tableDatapoint.appendChild(document.createTextNode(formatNumber(datapoint)));
			// Highlight pivot element.
			if (rowIndex === pivotPosition.y && columnIndex === pivotPosition.x) {
				tableDatapoint.style.backgroundColor = "#fa4d567F";
			}
			// Highlight cost function.
			if (rowIndex === 0) {
				tableDatapoint.style.backgroundColor = "#f1c21b7F";
			}
			// Highlight original cost function if in Phase `1`.
			if (phase === 1 && rowIndex === body.length - 1) {
				tableDatapoint.style.backgroundColor = "#42be657F";
			}
			tableRow.appendChild(tableDatapoint);
		});
		tableBody.appendChild(tableRow);
	});

	const captionElement = document.createElement("caption");
	table.appendChild(tableBody);
	captionElement.appendChild(document.createTextNode(caption));
	table.appendChild(captionElement);
	anchor.appendChild(table);
};

export const clearResults = () => {
	const results = document.getElementById("results");
	while(results.firstChild) {
		results.removeChild(results.lastChild);
	}
	const tableauAnchor = document.getElementById("tableau-anchor");
	while(tableauAnchor.firstChild) {
		tableauAnchor.removeChild(tableauAnchor.lastChild);
	}
	results.style.display = "none";
	document.getElementById("legend").style.display = "none";
	document.getElementById("input").style.border = "1px solid #000000";
	document.querySelector(".invalid-text").textContent = "";
};

export const generateResultNodeAndScrollIntoView = (text) => {
	const displayResults = document.getElementById("results");
	displayResults.appendChild(document.createTextNode(text));
	displayResults.style.display = "block";
	document.getElementById("legend").style.display = "block";
	displayResults.scrollIntoView({ behavior: "smooth", block: "center" });
};

export const displayPhaseOneResult = (text) => {
	const tableauAnchor = document.getElementById("tableau-anchor");
	const phaseOneResultNode = document.createElement("h2");
	phaseOneResultNode.appendChild(document.createTextNode(text));
	phaseOneResultNode.style.textAlign = "center";
	tableauAnchor.appendChild(phaseOneResultNode);
};

export const setInvalidInputState = (invalidText) => {
	document.getElementById("input").style.border = "0.15rem solid #da1e28";
	document.querySelector(".invalid-text").appendChild(document.createTextNode(invalidText));
};

export const generatePhaseHeading = (headingText) => {
	const tableauAnchor = document.getElementById("tableau-anchor");
	const phaseTwoHeading = document.createElement("h2");
	phaseTwoHeading.appendChild(document.createTextNode(headingText));
	phaseTwoHeading.style.fontWeight = "bold";
	tableauAnchor.appendChild(phaseTwoHeading);
};

// Only reformat the number if it has a decimal value.
export const formatNumber = (number) => Math.round(number) === number ? number : number.toFixed(2);
