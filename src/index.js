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
	displayPhaseOneResult,
	generatePhaseHeading,
	formatNumber
} from "./dom-utils.js";

const runSimplex = () => {
	clearResults();
	const parsedResult = parse();

	if (parsedResult.isInvalid) {
		return;
	}

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
	generatePhaseHeading("Phase one");
	generateTable(tableau, distinctVariableNames, "Initial Tableau", getPivotPosition(tableau, 1), 1);
	tableau = doSimplex(tableau, distinctVariableNames, 1);
	const isFeasible = isProblemFeasible(tableau);
	const phaseOneResult = calculateCoefficients(tableau, initialVariableNames, distinctVariableNames);
	/* eslint-disable indent */
	displayPhaseOneResult(`
		${
			isFeasible
				? `The problem is feasible. The initial vertex calculated is:
					${phaseOneResult.map((result => `${result.variable} = ${formatNumber(result.value)}`))}`
				: "The problem is infeasible."
		}
	`);
	/* eslint-enable indent */
	if (!isFeasible) {
		generateResultNodeAndScrollIntoView("The problem is infeasible.");
		return;
	}

	// PHASE 2
	const phaseTwo = transitionToPhaseTwo(tableau, distinctVariableNames, initialVariableNames, comparisons);
	tableau = phaseTwo.tableau;
	distinctVariableNames = phaseTwo.distinctVariableNames;
	generatePhaseHeading("Phase two");
	generateTable(tableau, distinctVariableNames, "Initial Tableau", getPivotPosition(tableau, 2), 2);
	tableau = doSimplex(tableau, distinctVariableNames, 2);
	if (tableau) {
		const results = calculateCoefficients(tableau, initialVariableNames, distinctVariableNames);
		generateResultNodeAndScrollIntoView(`
			The ${optimizationType === "max" ? "maximum" : "minimum"} value of
			${formatNumber(tableau[0][distinctVariableNames.length - 1] * -1 * (optimizationType === "min" ? -1 : 1))}
			can be achieved with: ${results.map(result => `${result.variable} = ${formatNumber(result.value)}`)}
		`);
	}
};

window.runSimplex = runSimplex;
window.clearResults = clearResults;
