import { parse } from "./parser.js";
import {
	getPivotPosition,
	doSimplex,
	generatePhaseOne,
	transitionToPhaseTwo
} from "./simplex.js";
import {
	cloneTableau,
	isProblemFeasible,
	calculateCoefficients
} from "./utils.js";
import {
	generateTable,
	clearResults,
	generateResultNodeAndScrollIntoView,
	displayPhaseResult,
	generatePhaseHeading,
	formatNumber,
	shouldDisplayTables
} from "./dom-utils.js";

const runSimplex = () => {
	clearResults();
	const parsedResult = parse();
	if (parsedResult.isInvalid) {
		return;
	}

	const displayTables = shouldDisplayTables();

	let { distinctVariableNames } = parsedResult;
	let initialVariableNames = [...distinctVariableNames];
	const { comparisons } = parsedResult;
	let tableau = cloneTableau(parsedResult.tableau);
	const initialTableau = cloneTableau(tableau);
	const { optimizationType } = parsedResult;

	// To find a minimum value, turn the problem into a maximization problem by finding the
	// maximum value of the negative version of the original cost function.
	if (optimizationType === "min") {
		tableau[0] = tableau[0].map(coefficient => coefficient * -1);
		initialTableau[0] = initialTableau[0].map(coefficient => coefficient * -1);
	}

	// PHASE 1
	const auxiliaryProblem = generatePhaseOne(tableau, distinctVariableNames, comparisons);
	tableau = auxiliaryProblem.tableau;
	distinctVariableNames = auxiliaryProblem.distinctVariableNames;
	if (displayTables) {
		generatePhaseHeading("Phase one");
		generateTable(tableau, distinctVariableNames, "Initial Tableau", getPivotPosition(tableau, 1), 1);
	}
	tableau = doSimplex(tableau, distinctVariableNames, 1);
	const isFeasible = isProblemFeasible(tableau);
	if (displayTables) {
		const phaseOneResult = calculateCoefficients(tableau, initialVariableNames, distinctVariableNames);
		/* eslint-disable indent */
		displayPhaseResult(`
			${
				isFeasible
					? `The problem is feasible. The initial vertex calculated is:
						${phaseOneResult.map((result => `${result.variable} = ${formatNumber(result.value)}`))}`
					: "The problem is infeasible."
			}
		`);
	}
	/* eslint-enable indent */
	if (!isFeasible) {
		generateResultNodeAndScrollIntoView("The problem is infeasible.");
		return;
	}

	// PHASE 2
	const phaseTwo = transitionToPhaseTwo(tableau, distinctVariableNames, initialVariableNames, comparisons);
	tableau = phaseTwo.tableau;
	distinctVariableNames = phaseTwo.distinctVariableNames;
	if (displayTables) {
		generatePhaseHeading("Phase two");
		generateTable(tableau, distinctVariableNames, "Initial Tableau", getPivotPosition(tableau, 2), 2);
	}
	tableau = doSimplex(tableau, distinctVariableNames, 2);
	if (tableau) {
		const results = calculateCoefficients(tableau, initialVariableNames, distinctVariableNames);
		generateResultNodeAndScrollIntoView(`
			The ${optimizationType === "max" ? "maximum" : "minimum"} value of
			${formatNumber(tableau[0][distinctVariableNames.length - 1] * -1 * (optimizationType === "min" ? -1 : 1))}
			can be achieved with: ${results.map(result => `${result.variable} = ${formatNumber(result.value)}`)}
		`);
		if (displayTables) {
			displayPhaseResult(`
				The ${optimizationType === "max" ? "maximum" : "minimum"} value of
				${formatNumber(tableau[0][distinctVariableNames.length - 1] * -1 * (optimizationType === "min" ? -1 : 1))}
				can be achieved with: ${results.map(result => `${result.variable} = ${formatNumber(result.value)}`)}
			`);
		}
	} else if (displayTables) {
		displayPhaseResult("A positive cost function coefficient is unable to be cancelled out. The problem is unbounded.");
	}
};

window.runSimplex = runSimplex;
window.clearResults = clearResults;
