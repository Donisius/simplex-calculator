export const cloneTableau = (tableau) => [...tableau].map(row => [...row]);

export const getNumberOfStrictInequalities = (comparisons) => (
	comparisons.reduce((count, comparison) => comparison === ">=" || comparison === "<=" ? count + 1 : count, 0)
);

// This should be used at the end of phase one.
// The problem is feasible if and only if all the coefficients in the auxiliary cost function is <= 0
// AND the optimal solution to the auxiliary problem is 0.
export const isProblemFeasible = (tableau) => {
	const precision = 0.00000000001; // For floating point strict compares.
	return tableau[0]
		.slice(1, -1)
		// If precision - abs(value) is greater than zero, we round the value to ~0.
		.every(coefficient => coefficient <= 0) && precision - Math.abs(tableau[0][tableau[0].length - 1]) >= 0;
};

// The problem is unbounded if at any point there is a cost function coefficient that is
// strictly positive and can not be pivoted out.
export const isProblemUnbounded = (tableau) => (
	tableau[0].slice(1, -1).some((costCoefficient, columnIndex) => (
		costCoefficient > 0
			? tableau.slice(1).every(row => row[columnIndex + 1] <= 0) // columnIndex + 1 to accomodate for slice.
			: false
	))
);

/**
 * Find the value of the variables of the cost function based on the given tableau.
 *
 * @param tableau 
 * @param initialVariableNames 
 * @param currentVariableNames 
 */
export const calculateCoefficients = (tableau, initialVariableNames, currentVariableNames) => {
	const values = [];
	initialVariableNames.forEach(variableName => {
		const headerPosition = currentVariableNames.indexOf(variableName);
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
