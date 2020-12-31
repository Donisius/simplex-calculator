// TODO: catch invalid inputs.
const parse = () => {
	const textContent = document.getElementById("input").value;

	// All coefficients of each equation (row).
	const coefficients = [];
	// All variable names of each equation (row). This is used to keep track of the order
	// of the coefficients.
	const variableNames = [];
	// All of the comparisons of each equation (row). This must be `>=` or `<=` to find a
	// true maximum of minumum optimal value.
	const comparisons = [];
	// This will maintain the order of each row's variables. Variables can be input like:
	// max x1 + x2 + x3
	// x4 + x3 + x1
	// and some kind of ordering needs to be maintained to take this into account.
	const distinctVariableNames = [];
	let optimizationType; // Can be `max` or `min`.
	const optimizationTypeRegex = /max|min/;

	// This is used to keep track of the coefficients of a particular row. After the row's coefficients
	// have been added to `coefficients`, this will be reset and populated in the next iteration.
	let rowCoefficients = [];
	// This is used to keep track of the variable names of a particular row. After the row's variable names
	// have been added to `variableNames`, this will be reset, and populated in the next iteration.
	let rowVariableNames = [];

	textContent.split(/\n/).forEach(line => {
		// If line is just whitespace, ignore it.
		if (!line.replace(/\s/g, "").length) {
			return;
		}

		// This is a pretty straightforward parsing algorithm. TODO: Make this more robust.
		// Each character in the line will be iterated over and we try and predict whether a particular
		// character is a part of the following:
		// `signum`: can be `+` or `-`
		// `coefficient`: numbers that go directly before a `variableName`
		// `variableName`: can be anything that doesn't start with a `+`, `-`, `<`, ``>`, `=`, or a number
		// `comparison`: can be `>=` or `<=`
		// If we detect that one of these is finished building, then they will be pushed to their
		// corresponding arrays.
		let signum = "positive";
		let coefficient = "";
		let variableName = "";
		let comparison = "";

		// Push row produced at the end to top of the arrays if it's the cost function.
		let isCostFunction = optimizationTypeRegex.test(line);
		if (isCostFunction) {
			optimizationType = line.match(optimizationTypeRegex)[0];
			line = line.replace(optimizationTypeRegex, "");
		}

		[...line].forEach((char, columnIndex) => {
			if (char === "<" || char === "=" || char === ">") {
				comparison = comparison.concat(char);
			}

			// Number char codes are between 48 and 57.
			else if ((char.charCodeAt(0) >= 48 && char.charCodeAt(0) <= 57
				&& variableName.length === 0) // variableNames can have numbers too.
				|| char.charCodeAt(0) === 46) { // Periods (for decimals).
				coefficient = coefficient.concat(char);
			}
			
			else if (char !== "+" && char !== " " && char !== "-") {
				variableName = variableName.concat(char);
			}
			
			else if (char === "-") {
				signum = "negative";
			}

			// `variableName` and `coefficient` are done being built and can be pushed to their
			// corresponding arrays.
			if (((char === " "
				|| char === "+"
				|| char === "-"
				|| char === "<"
				|| char === "="
				|| char === ">")
				&& variableName.length !== 0) || columnIndex === line.length - 1) {
				// Cases like `x1 + x2`.
				if (coefficient.length === 0) {
					coefficient = "1";
				}

				if (signum === "negative") {
					coefficient = "-" + coefficient;
				}

				rowCoefficients.push(parseFloat(coefficient));
				if (variableName.length) {
					rowVariableNames.push(variableName);
					if (!distinctVariableNames.includes(variableName)) {
						distinctVariableNames.push(variableName);
					}
				}

				// Reset tokens.
				signum = "positive";
				coefficient = "";
				variableName = "";
			}
		});

		if (!isCostFunction) {
			comparisons.push(comparison);
			coefficients.push(rowCoefficients);
			variableNames.push(rowVariableNames);
		} else { // Cost function will be at the top.
			coefficients.unshift(rowCoefficients);
			variableNames.unshift(rowVariableNames);
		}

		// Reset row trackers.
		rowCoefficients = [];
		rowVariableNames = [];
	});

	const tableau = [];
	variableNames.forEach((rowVariables, rowIndex) => {
		let adjustedCoefficients = [];
		distinctVariableNames.forEach(distinctVariableName => {
			variableIndex = rowVariables.indexOf(distinctVariableName);
			adjustedCoefficients.push(variableIndex === -1 ? 0 : coefficients[rowIndex][variableIndex]);
		});
		if (rowIndex > 0) {
			// Add the "RHS" of the equation, which wouldn't be automatically included since
			// the "RHS" distinct variable name has not been added yet.
			adjustedCoefficients.push(coefficients[rowIndex].slice(-1)[0]);
		}
		tableau.push(adjustedCoefficients);
		adjustedCoefficients = [];
	});

	return {
		tableau,
		distinctVariableNames,
		comparisons,
		optimizationType
	};
};

/**
 * We use Dantzig's here to calculate which element to use as the pivot. It goes as follows:
 * 1. We pick the column where the objective function's coefficient is post positive (largest).
 * 2. Once a column is decided, the row to pivot on is determined by the smallest nonnegative ratio
 * of the RHS by the corresponding positive coefficient in the pivoting column.
 *
 * We are also using Bland's Rule to minimize the chance of cycles occuring which goes as follows:
 * 1. Among the variables that has a poitive coefficient in the cost function, pick the left-most one.
 * 2. Among the rows that satisfy the min ratio rule, pick the up-most one.
 *
 * @param tableau
 * @param phase Phase `1` or Phase `2` of the simplex method.
 */
const getPivotPosition = (tableau, phase) => {
	// +1 at the end to account for removing the cost variable from the calculation.
	const pivotColumnIndex = tableau[0].slice(1).indexOf(Math.max(...tableau[0].slice(1, -1))) + 1;
	let minRatio = Number.MAX_VALUE;
	let pivotRowIndex;
	// If phase is `1`, then the last row in the tableau contains the original cost function
	// and we need to ignore it as a viable option to pivot on.
	const lastIndex = tableau.length - (phase === 1 ? 1 : 0);
	for (let i = 1; i < lastIndex; i++) {
		const ratio = tableau[i][tableau[i].length - 1] / tableau[i][pivotColumnIndex];
		if (ratio < minRatio && ratio >= 0 && tableau[i][pivotColumnIndex] >= 0) {
			minRatio = ratio;
			pivotRowIndex = i;
		}
	}
	return { x: pivotColumnIndex, y: pivotRowIndex };
};

/**
 * For each iteration:
 * 1. Check if there are any positive nonzero coefficients in the cost function, if there are,
 * keep going, if not then an optimal solutuon has been achieved and we can stop.
 * 2. Get the pivot position using Dantzig's rule. Check out `getPivotPosition` for details.
 *
 * @param tableau
 * @param distinctVariableNames 
 * @param iterationStart This is for the generation of the tables captions.
 * @param phase Phase `1` or phase `2` of the simplex method.
 */
const doSimplex = (tableau, distinctVariableNames, iterationStart, phase) => {
	modifiedTableau = cloneTableau(tableau);
	if (isProblemUnbounded(modifiedTableau)) {
		generateResultNode("The problem is unbounded and no optimal solution exists.");
		return;
	}
	let iteration = iterationStart;
	// TODO: Add cycle detection.
	while (!modifiedTableau[0].slice(1, -1).every((datapoint => datapoint <= 0))) {
		pivotPosition = getPivotPosition(modifiedTableau, phase);

		if (pivotPosition.x === undefined || pivotPosition.y === undefined) {
			return modifiedTableau;
		}

		modifiedTableau.forEach((row, rowIndex) => {
			if (rowIndex === pivotPosition.y) {
				return;
			} else {
				const pivotCoefficient
					= modifiedTableau[rowIndex][pivotPosition.x] / modifiedTableau[pivotPosition.y][pivotPosition.x];
				modifiedTableau[rowIndex]= row.map((datapoint, columnIndex) =>
					datapoint - modifiedTableau[pivotPosition.y][columnIndex] * pivotCoefficient
				);
			}
		});
		// You might be asking, "Why in the world would you call `getPivotPosition` again here?",
		// and well that's because in order to properly indicate which row to pivot on next on the
		// html table, we need to preemptively calculate it's pivot position. I need to know what the
		// table needs to contain before I generate it so leave me alone. Can this be better, definitely.
		generateTable(distinctVariableNames,
			modifiedTableau,
			`Tableau ${iteration}`,
			getPivotPosition(modifiedTableau, phase),
			phase
		);
		iteration++;
	}
	return modifiedTableau;
};

/**
 * Creates an auxiliary problem such that there is an obvious initial basic feasible solution and an
 * optimal solution in the auxiliary problem is feasible for the original problem, and can be used
 * as an initial vertex.
 *
 * This function introduces slack variables to make inequalities into equalities
 * and auxiliary variables to relax the original problem.
 *
 * @param tableau 
 * @param distinctVariableNames 
 * @param comparisons 
 */
const generatePhaseOne = (tableau, distinctVariableNames, comparisons) => {
	const relaxedTableau = cloneTableau(tableau);
	const modifiedVariableNames = [...distinctVariableNames];

	// Keep the original cost function in phase one, and carry out the operations as we normally do
	// with the exception of ignoring the row containing the original cost function as a viable option
	// as a pivot.
	const originalCostFunction = [
		1, // Cost variable coefficient.
		...relaxedTableau[0], // Original cost function coefficients.
		// Introduced slack and auxiliary variables set to zero.
		...new Array(tableau.length + getNumberOfStrictInequalities(comparisons)).fill(0)
	];

	// Set cost function coefficients to zero in the auxiliary tableau.
	relaxedTableau[0] = relaxedTableau[0].map(_ => 0);
	// Cost function's RHS.
	relaxedTableau[0].push(0);

	// Add the cost variable.
	relaxedTableau.forEach((row, rowIndex) => row.unshift(rowIndex === 0 ? 1 : 0));
	modifiedVariableNames.unshift("-z");

	// Introduce slack variables.
	let slackCounter = 0;
	for (let i = 1; i < relaxedTableau.length; i++) {
		const comparison = comparisons[i - 1];
		// If comparison is a strict equality, no need to introduce a slack variable.
		if (comparison === "=") {
			continue;
		}
		relaxedTableau[i].splice(-1, 0, comparison === ">=" ? -1 : 1);
		relaxedTableau.forEach((row, rowIndex) => {
			if (rowIndex === i) {
				return;
			}
			row.splice(-1, 0, 0);
		});
		modifiedVariableNames.push(`s${slackCounter}`);
		slackCounter++;
	}

	// Introduce auxiliary variables.
	let auxCounter = 0;
	for (let i = 1; i < relaxedTableau.length; i++) {
		relaxedTableau[i].splice(-1, 0, 1);
		relaxedTableau.forEach((row, rowIndex) => {
			if (rowIndex === i) {
				return;
			} else {
				row.splice(-1, 0, rowIndex === 0 ? -1 : 0);
			}
		});
		modifiedVariableNames.push(`a${auxCounter}`);
		auxCounter++;
	}

	modifiedVariableNames.push("RHS");

	// Add original cost function as the last row of the tableau.
	relaxedTableau.push(originalCostFunction);

	return {
		tableau: relaxedTableau,
		distinctVariableNames: modifiedVariableNames
	};
};

/**
 * Find the value of the variables of the cost function based on the given tableau.
 *
 * @param tableau 
 * @param initialVariableNames 
 * @param currentVariableNames 
 */
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
			};
			values.push(valuePair);
		} else {
			values.push({
				variable: variableName,
				value: 0
			});
		}
	});
	return values;
};

/**
 * Generates an html table in the DOM.
 *
 * @param headers Table headers.
 * @param body Table body.
 * @param caption Table caption.
 * @param pivotPosition Indicates which position to highlight on the table.
 * @param phase Phase `1` or phase `2` of the simplex method. In phase 1 the function highlights the
 * row containing the original cost function.
 */
const generateTable = (headers, body, caption = "Tableau", pivotPosition = { x: null, y: null }, phase) => {
	const anchor = document.getElementById("tableau-anchor");

	const table = document.createElement("table");
	table.className = "tableau";
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
	document.getElementById("legend").style.display = "none";
};

const cloneTableau = (tableau) => [...tableau].map(row => [...row]);
const getNumberOfStrictInequalities = (comparisons) => (
	comparisons.reduce((count, comparison) => comparison === ">=" || comparison === "<=" ? count + 1 : count, 0)
);
// This should be used at the end of phase one.
// The problem is feasible if and only if all the coefficients in the auxiliary cost function is <= 0
// AND the optimal solution to the auxiliary problem is 0.
const isProblemFeasible = (tableau) => (
	tableau[0].slice(1, -1).every(coefficient => coefficient <= 0) && tableau[0][tableau.length - 1] === 0
);
// The problem is unbounded if at any point there is a cost function coefficient that is
// strictly positive and can not be pivoted out.
const isProblemUnbounded = (tableau) => (
	tableau[0].slice(1, -1).some((costCoefficient, columnIndex) => (
		costCoefficient > 0
			? tableau.slice(1).every(row => row[columnIndex + 1] <= 0) // columnIndex + 1 to accomodate for slice.
			: false
	))
);
const generateResultNode = (text) => {
	const displayResults = document.getElementById("results");
	displayResults.appendChild(document.createTextNode(text));
	displayResults.style.display = "block";
	document.getElementById("legend").style.display = "block";
};

const main = () => {
	clearResults();
	const tableauAnchor = document.getElementById("tableau-anchor");
	const parsedResult = parse();
	let { distinctVariableNames } = parsedResult;
	let initialVariableNames = [...distinctVariableNames];
	const { comparisons } = parsedResult;
	let tableau = cloneTableau(parsedResult.tableau);
	const initialTableau = cloneTableau(tableau);
	const { optimizationType } = parsedResult;

	if (optimizationType === "min") {
		tableau[0] = tableau[0].map(coefficient => coefficient * -1);
		initialTableau[0] = initialTableau[0].map(coefficient => coefficient * -1);
	}

	// PHASE 1
	const auxiliaryProblem = generatePhaseOne(tableau, distinctVariableNames, comparisons);
	tableau = auxiliaryProblem.tableau;
	distinctVariableNames = auxiliaryProblem.distinctVariableNames;

	const phaseOneHeading = document.createElement("h2");
	phaseOneHeading.appendChild(document.createTextNode("Phase One"));
	phaseOneHeading.style.fontWeight = "bold";
	tableauAnchor.appendChild(phaseOneHeading);

	generateTable(distinctVariableNames, tableau, "Initial Tableau", undefined, 1);
	// Use gaussian elimination to get all auxiliary variables in the cost function to zero
	// by adding all the other rows to the cost function.
	tableau[0] = tableau[0].map((datapoint, columnIndex) => (
		// Ignore the cost variable and the RHS.
		datapoint + tableau.slice(1, -1).reduce((currentTotal, row) =>
			currentTotal + row[columnIndex], 0
		)
	));
	generateTable(distinctVariableNames, tableau, "Tableau 0", getPivotPosition(tableau, 1), 1);
	tableau = doSimplex(tableau, distinctVariableNames, 1, 1);

	const isFeasible = isProblemFeasible(tableau);

	const phaseOneResult = calculateCoefficients(tableau, initialVariableNames, distinctVariableNames);
	const phaseOneResultNode = document.createElement("h2");
	/* eslint-disable indent */
	phaseOneResultNode.appendChild(document.createTextNode(`
		${
			isFeasible
				?`The problem is feasible. The initial vertex calculated is:
				${phaseOneResult.map((result => `${result.variable} = ${result.value}`))}`
				: "The problem is infeasible."
		}
	`));
	/* eslint-enable indent */
	phaseOneResultNode.style.textAlign = "center";
	tableauAnchor.appendChild(phaseOneResultNode);

	if (!isFeasible) {
		generateResultNode("The problem is infeasible.");
		return;
	}

	// PHASE 2
	// Remove imaginary coefficients.
	tableau.forEach((row) => {
		row.splice(
			// Number of original cost function coefficients + number of introduced slack variables + cost variable (z).
			initialVariableNames.length + getNumberOfStrictInequalities(comparisons) + 1,
			tableau.length - 2 // Number of introduced auxiliary variables.
		);
	});
	// Remove imaginary variables.
	distinctVariableNames.splice(
		// Number of original cost function coefficients + number of introduced slack variables + cost variable (z).
		initialVariableNames.length + getNumberOfStrictInequalities(comparisons) + 1,
		tableau.length - 2 // Number of introduced auxiliary variables.
	);

	// Make the original cost function as the first row and remove the
	// original cost function from the last row.
	tableau[0] = tableau.pop();

	const phaseTwoHeading = document.createElement("h2");
	phaseTwoHeading.appendChild(document.createTextNode("Phase Two"));
	phaseTwoHeading.style.fontWeight = "bold";
	tableauAnchor.appendChild(phaseTwoHeading);

	generateTable(
		distinctVariableNames,
		tableau,
		"Initial Tableau",
		getPivotPosition(tableau, 2),
		2
	);
	tableau = doSimplex(tableau, distinctVariableNames, 0, 2);
	results = calculateCoefficients(tableau, initialVariableNames, distinctVariableNames);

	generateResultNode(`
		The ${optimizationType === "max" ? "maximum" : "minimum"} value of
		${tableau[0][distinctVariableNames.length - 1] * -1 * (optimizationType === "min" ? -1 : 1)}
		can be achieved with: ${results.map(result => `${result.variable} = ${result.value}`)}
	`);
};
