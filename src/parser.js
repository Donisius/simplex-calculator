import { setInvalidInputState } from "./dom-utils.js";

const noOptimizationTypeText = "Indicate a cost function by putting 'max' or 'min' on the same line as the cost equation. Please refer to the examples above.";
const noLeftVariablesText = "Variables must be on the left hand side of each constraint. Please refer to the examples above.";
const strictComparatorsOnlyText = "Comparators must all be one of the following: >=, =, or <=. Please refer to the example above.";
const noSpecialVariablesText = (variableName = "Variable name") => `${variableName} is a reserved variable. Variable names cannot be 's' followed by a number or 'a' followed by a number`;

export const parse = () => {
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
	const specialVariableRegex = /[s]{1}[0-9]+|[a]{1}[0-9]+/;

	// This is used to keep track of the coefficients of a particular row. After the row's coefficients
	// have been added to `coefficients`, this will be reset and populated in the next iteration.
	let rowCoefficients = [];
	// This is used to keep track of the variable names of a particular row. After the row's variable names
	// have been added to `variableNames`, this will be reset, and populated in the next iteration.
	let rowVariableNames = [];

	const separatedEquations = textContent.split(/\n/);

	if (!optimizationTypeRegex.test(textContent)) {
		setInvalidInputState(noOptimizationTypeText);
		return { isInvalid: true };
	}

	// Cannot use array array loop methods because we want to immediately return from the whole function if
	// an invalid input is detected at any point.
	let line;
	for (line of separatedEquations) {
		// If line is just whitespace, ignore it.
		if (!line.replace(/\s/g, "").length) {
			continue;
		}

		// This is a pretty straightforward parsing algorithm.
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

		// Cannot use array array loop methods because we want to immediately return from the whole function if
		// an invalid input is detected at any point.
		for (let columnIndex = 0; columnIndex < line.length; columnIndex++) {
			const char = line[columnIndex];
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
				if (comparison.length) {
					setInvalidInputState(noLeftVariablesText);
					return { isInvalid: true };
				}
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
					if (specialVariableRegex.test(variableName)) {
						setInvalidInputState(noSpecialVariablesText(variableName));
						return { isInvalid: true };
					}

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
		}

		if (!isCostFunction) {
			if (![">=", "=", "<="].includes(comparison)) {
				setInvalidInputState(strictComparatorsOnlyText);
				return { isInvalid: true };
			}
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
	}

	const tableau = [];
	variableNames.forEach((rowVariables, rowIndex) => {
		let adjustedCoefficients = [];
		distinctVariableNames.forEach(distinctVariableName => {
			const variableIndex = rowVariables.indexOf(distinctVariableName);
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
		optimizationType,
		isInvalid: false
	};
};
