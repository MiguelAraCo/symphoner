export type ObjectMap = { [name:string]:any };

/**
 * Specifies the action to be executed with the given distribution
 */
export interface Scenario {
	/**
	 * Probability of the scenario to be executed. Needs to be an <strong>integer</strong> that may or may not
	 * be based on 0-100
	 */
	probability:number;

	/**
	 * Path of the file where the action is defined
	 *
	 * {@see Action}
	 */
	action:string;
}

/**
 * Specifies a phase of a {@link Test}. Each phase defines what to run and how to run it for the given duration.
 */
export interface Phase {
	/**
	 * Duration of the phase in <strong>milliseconds</strong>
	 */
	duration:number;

	/**
	 * Max number of clients to have running at the same time on the phase
	 */
	clients:number;

	/**
	 * Rate at which clients are added to the phase in <strong>milliseconds</strong>
	 */
	arrivalRate:number;

	/**
	 * {@link Scenario}s from which the clients will execute specified actions randomly based on their probability
	 */
	scenarios:Scenario[];
}

/**
 * Specification of a test that is mainly composed of {@link Phase}s
 */
export interface Test {
	/**
	 * {@link Phase}s to run as part of the test
	 */
	phases:Phase[];
}
