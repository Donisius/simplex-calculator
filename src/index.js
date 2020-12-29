const parse = () => {
	const textContent = document.getElementById("input").value;
	const coefficients = [];
	const variableNames = [];
	const comparisons = [];
	const distinctVariableNames = [];

	let rowCoefficients = [];
	let rowVariableNames = [];
	textContent.split(/\n/).forEach((line, rowIndex) => {
		if (!line.replace(/\s/g, "").length) {
			return;
		}
		let signum = "positive";
		let coefficient = "";
		let variableName = "";
		let comparison = "";
		let i = 0;
		while (i < line.length) {
			if (line[i] === "-") {
				signum = "negative";
			}

			// Build comparison.
			else if (line[i] === "<" || line[i] === "=" || line[i] === ">") {
				comparison = comparison.concat(line[i]);
			}

			// Build coefficient.
			else if ((line.charCodeAt(i) >= 48
				&& line.charCodeAt(i) <= 57
				&& variableName.length === 0
				) || comparison.length === 2) {
				coefficient = coefficient.concat(line[i])
			}

			// Must be part of a variable name.
			else if (line[i] !== "+" && line[i] !== " ") {
				variableName = variableName.concat(line[i]);
			}

			// Variable name and coefficient value is finished being built.
			if (variableName.length !== 0
				&& (
					line[i] === "+"
					|| line[i] === " "
					|| line[i] === "-"
					|| line[i] === "<"
					|| line[i] === "="
					|| line[i] === ">"
				)) {
				if (coefficient.length === 0) {
					coefficient = "1";
				}
				if (signum === "negative") {
					rowCoefficients.push(-parseInt(coefficient))
				} else {
					rowCoefficients.push(parseInt(coefficient))
				}

				rowVariableNames.push(variableName);
				if (!distinctVariableNames.includes(variableName)) {
					distinctVariableNames.push(variableName);
				}

				// Reset tokens.
				signum = "positive";
				coefficient = "";
				variableName = "";
			}

			i++
		}
		// Push remaining variable name and coefficient.
		if (signum === "negative") {
			rowCoefficients.push(-parseInt(coefficient))
		} else {
			rowCoefficients.push(parseInt(coefficient))
		}

		if (rowIndex > 0) {
			comparisons.push(comparison);
		} else {
			rowVariableNames.push(variableName);
			if (!distinctVariableNames.includes(variableName)) {
				distinctVariableNames.push(variableName);
			}
		}

		variableNames.push(rowVariableNames);
		coefficients.push(rowCoefficients);
		rowVariableNames = [];
		rowCoefficients = [];
	});

	// Generate initial tableau.
	const tableau = [];
	variableNames.forEach((rowVariableNames, rowIndex) => {
		let rowValues = [];
		distinctVariableNames.forEach((distinctVariableName) => {
			namePosition = rowVariableNames.indexOf(distinctVariableName);
			if (namePosition === -1) {
				rowValues.push(0);
			} else {
				rowValues.push(coefficients[rowIndex][namePosition]);
			}
		});
		if (rowIndex > 0) {
			rowValues.push(coefficients[rowIndex].slice(-1)[0]);
		}
		tableau.push(rowValues);
		rowValues = [];
	});

	return {
		tableau,
		distinctVariableNames,
		comparisons
	}
}

const simplex = () => {
	clearResults();
	const initialTableau = parse();
	let { distinctVariableNames } = initialTableau;
	let initialVariableNames = [...distinctVariableNames];
	const { comparisons } = initialTableau;
	let modifiedTableau = [...initialTableau.tableau];

	phaseOne = generatePhaseOneTableau(modifiedTableau, distinctVariableNames, comparisons);
	modifiedTableau = phaseOne.tableau;
	distinctVariableNames = phaseOne.distinctVariableNames;

	// PHASE 1
	const anchor = document.getElementById("tableau-anchor");

	const phaseOneNode = document.createElement("h2");
	phaseOneNode.appendChild(document.createTextNode("PHASE 1"));
	anchor.appendChild(phaseOneNode);

	generateTable(distinctVariableNames, modifiedTableau, "Initial Tableau");

	// Get to first tableau.
	modifiedTableau[0] = modifiedTableau[0].map((datapoint, columnIndex) => (
		datapoint + modifiedTableau.slice(1).reduce((currentTotal, row) =>
			currentTotal + row[columnIndex], 0
		)
	));
	generateTable(distinctVariableNames, modifiedTableau, "Tableau 0", getPivotPosition(modifiedTableau));
	modifiedTableau = danzig(modifiedTableau, distinctVariableNames, 1, getPivotPosition(modifiedTableau));

	const phaseOneResult = calculateCoefficients(modifiedTableau, initialVariableNames, distinctVariableNames);
	const phaseOneResultNode = document.createElement("h4");
	phaseOneResultNode.appendChild(document.createTextNode(`
		LO is feasible. The initial vertex calculated is:
		${phaseOneResult.map((result => `${result.variable} = ${result.value}`))}
	`));
	phaseOneResultNode.style.textAlign = "center"
	anchor.appendChild(phaseOneResultNode);

	// PHASE 2

	// Remove imaginary coefficients.
	modifiedTableau.forEach((row) => {
		row.splice(initialTableau.tableau.length + modifiedTableau.length - 1, modifiedTableau.length - 1);
	});
	// Remove imaginary variables.
	distinctVariableNames.splice(
		initialTableau.tableau.length + modifiedTableau.length - 1,
		modifiedTableau.length - 1
	);
	// Use initial coeffieicnets.
	modifiedTableau[0].splice(1, initialTableau.tableau[0].length, ...initialTableau.tableau[0]);

	const phaseTwoNode = document.createElement("h2");
	phaseTwoNode.appendChild(document.createTextNode("PHASE 2"));
	anchor.appendChild(phaseTwoNode);

	generateTable(
		distinctVariableNames,
		modifiedTableau,
		`Initial Tableau`,
		getPivotPosition(modifiedTableau)
	);
	modifiedTableau = danzig(modifiedTableau, distinctVariableNames, 0);
	results = calculateCoefficients(modifiedTableau, initialVariableNames, distinctVariableNames);

	const displayResults = document.getElementById("results");
	displayResults.appendChild(document.createTextNode(`
		The optimal value of ${modifiedTableau[0][distinctVariableNames.length - 1] * -1}
		can be achieved with: ${results.map(result => `${result.variable} = ${result.value}`)}
	`));
	displayResults.style.display = "block";
}

const getPivotPosition = (tableau) => {
	const pivotColumnIndex = tableau[0].slice(1).indexOf(Math.max(...tableau[0].slice(1, -1))) + 1;
	let minRatio = Number.MAX_VALUE;
	let pivotRowIndex;
	for (let i = 1; i < tableau.length; i++) {
		const ratio = tableau[i][tableau[i].length - 1] / tableau[i][pivotColumnIndex];
		if (ratio < minRatio && ratio >= 0 && tableau[i][pivotColumnIndex] >= 0) {
			minRatio = tableau[i][tableau[i].length - 1] / tableau[i][pivotColumnIndex];
			pivotRowIndex = i;
		}
	}
	return { x: pivotColumnIndex, y: pivotRowIndex };
}

const calculateCoefficients = (tableau, initialVariableNames, currentVariableNames) => {
	const values = [];
	initialVariableNames.forEach(variableName => {
		headerPosition = currentVariableNames.indexOf(variableName);
		const shouldIncludeVariable = tableau.reduce((accumulator, row) =>
			row[headerPosition] !== 0 ? accumulator + 1 : accumulator,0
		) === 1;
		if (shouldIncludeVariable) {
			const rowIndex = tableau.indexOf(tableau.find(row => row[headerPosition] > 0));
			const valuePair = {
				variable: variableName,
				value: tableau[rowIndex][currentVariableNames.length - 1] / tableau[rowIndex][headerPosition]
			}
			values.push(valuePair);
		} else {
			values.push({
				variable: variableName,
				value: 0
			});
		}
	});
	return values;
}

const danzig = (modifiedTableau, distinctVariableNames, iterationStart) => {
	tableau = [...modifiedTableau];
	let iteration = iterationStart;
	while (!tableau[0].slice(1, -1).every((datapoint => datapoint <= 0))) {
		pivotPosition = getPivotPosition(tableau);

		tableau.forEach((row, rowIndex) => {
			if (rowIndex === pivotPosition.y) {
				return;
			} else {
				const pivotCoefficient
					= tableau[rowIndex][pivotPosition.x] / tableau[pivotPosition.y][pivotPosition.x];
				tableau[rowIndex]= row.map((datapoint, columnIndex) =>
					datapoint - tableau[pivotPosition.y][columnIndex] * pivotCoefficient
				);
			}
		});
		generateTable(distinctVariableNames, tableau, `Tableau ${iteration}`, getPivotPosition(tableau));
		iteration++;
	}
	return tableau;
}

const generatePhaseOneTableau = (tableau, distinctVariableNames, comparisons) => {
	const modifiedTableau = [...tableau]
	const modifiedVariableNames = [...distinctVariableNames];

	modifiedTableau[0] = modifiedTableau[0].map(_ => 0);
	modifiedTableau[0].push(0);

	modifiedTableau.forEach((row, rowIndex) => {
		if (rowIndex === 0) {
			row.unshift(1);
		} else {
			row.unshift(0);
		}
	});

	modifiedVariableNames.unshift("-z");

	let auxCounter = 0;
	for (let i = 1; i < modifiedTableau.length; i++) {
		if (comparisons[i - 1] === ">=") {
			modifiedTableau[i].splice(-1, 0, -1);
		} else {
			modifiedTableau[i].splice(-1, 0, 1);
		}
		modifiedTableau.forEach((row, rowIndex) => {
			if (rowIndex === i) {
				return;
			}

			row.splice(-1, 0, 0);
		});
		modifiedVariableNames.push(`Aux-${auxCounter}`);
		auxCounter++;
	}

	let imgCounter = 0;
	for (let i = 1; i < modifiedTableau.length; i++) {
		modifiedTableau[i].splice(-1, 0, 1);
		modifiedTableau.forEach((row, rowIndex) => {
			if (rowIndex === i) {
				return;
			} else if (rowIndex === 0) {
				row.splice(-1, 0, -1);
			} else {
				row.splice(-1, 0, 0);
			}
		});
		modifiedVariableNames.push(`Img-${imgCounter}`);
		imgCounter++;
	}

	modifiedVariableNames.push("RHS");
	return {
		tableau: modifiedTableau,
		distinctVariableNames: modifiedVariableNames
	}
}

const generateTable = (headers, body, caption = "Tableau", pivotPosition = { x: null, y: null }) => {
	const anchor = document.getElementById("tableau-anchor");

	const table = document.createElement("table");
	table.className = "tableau"
	const tableBody = document.createElement("tbody");
	const headerRow = document.createElement("tr");

	headers.forEach(header => {
		tableHeader = document.createElement("th");
		tableHeader.appendChild(document.createTextNode(header));
		headerRow.appendChild(tableHeader);
	});

	tableBody.appendChild(headerRow);

	body.forEach((row, rowIndex) => {
		tableRow = document.createElement("tr");
		row.forEach((datapoint, columnIndex) => {
			tableDatapoint = document.createElement("td");
			tableDatapoint.appendChild(document.createTextNode(datapoint));
			if (rowIndex === pivotPosition.y && columnIndex === pivotPosition.x) {
				tableDatapoint.style.backgroundColor = "#E8A87C";
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
}

const clearResults = () => {
	const results = document.getElementById("results");
	while(results.firstChild) {
		results.removeChild(results.lastChild);
	}
	const tableauAnchor = document.getElementById("tableau-anchor");
	while(tableauAnchor.firstChild) {
		tableauAnchor.removeChild(tableauAnchor.lastChild);
	}
	results.style.display = "none";
}
