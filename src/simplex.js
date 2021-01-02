import {
	cloneTableau,
	isProblemUnbounded,
	getNumberOfStrictInequalities
} from "./utils.js";

import {
	generateTable,
	generateResultNodeAndScrollIntoView,
	shouldDisplayTables
} from "./dom-utils.js";

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
export const getPivotPosition = (tableau, phase) => {
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
 * @param phase Phase `1` or phase `2` of the simplex method.
 */
export const doSimplex = (tableau, distinctVariableNames, phase) => {
	const modifiedTableau = cloneTableau(tableau);
	if (isProblemUnbounded(modifiedTableau)) {
		generateResultNodeAndScrollIntoView("The problem is unbounded and no optimal solution exists.");
		return;
	}
	let iteration = 0;
	while (!modifiedTableau[0].slice(1, -1).every((datapoint => datapoint <= 0))) {
		const pivotPosition = getPivotPosition(modifiedTableau, phase);

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
		if (shouldDisplayTables()) {
			// You might be asking, "Why in the world would you call `getPivotPosition` again here?",
			// and well that's because in order to properly indicate which row to pivot on next on the
			// html table, we need to preemptively calculate it's pivot position. I need to know what the
			// table needs to contain before I generate it (with this current set up).
			generateTable(
				modifiedTableau,
				distinctVariableNames,
				`Tableau ${iteration}`,
				getPivotPosition(modifiedTableau, phase),
				phase
			);
			iteration++;
		}
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
export const generatePhaseOne = (tableau, distinctVariableNames, comparisons) => {
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

	// Use gaussian elimination to get all auxiliary variables in the cost function to zero
	// by adding all the other rows to the cost function.
	relaxedTableau[0] = relaxedTableau[0].map((datapoint, columnIndex) => (
		// Ignore the cost variable and the RHS.
		datapoint + relaxedTableau.slice(1, -1).reduce((currentTotal, row) =>
			currentTotal + row[columnIndex], 0
		)
	));

	return {
		tableau: relaxedTableau,
		distinctVariableNames: modifiedVariableNames
	};
};

export const transitionToPhaseTwo = (tableau, distinctVariableNames, initialVariableNames, comparisons) => {
	const modifiedTableau = cloneTableau(tableau);
	const modifiedVariableNames = [...distinctVariableNames];

	// Number of original cost function coefficients + number of introduced slack variables + cost variable (z).
	const spliceStartIndex = initialVariableNames.length + getNumberOfStrictInequalities(comparisons) + 1;

	const numberOfElementsToRemove = modifiedTableau.length - 2; // Number of introduced auxiliary variables.

	// Remove imaginary coefficients.
	modifiedTableau.forEach((row) => {
		row.splice(spliceStartIndex, numberOfElementsToRemove);
	});
	// Remove imaginary variables.
	modifiedVariableNames.splice(spliceStartIndex, numberOfElementsToRemove);

	// Make the original cost function as the first row and remove the
	// original cost function from the last row.
	modifiedTableau[0] = modifiedTableau.pop();

	return {
		tableau: modifiedTableau,
		distinctVariableNames: modifiedVariableNames
	};
};
