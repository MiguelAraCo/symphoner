/**
 * Generate a number between min (inclusive) and max (inclusive)
 * @param min
 * @param max
 */
export function numberBetween( min:number, max:number ):number {
	return Math.random() * (max - min + 1) + min;
}
