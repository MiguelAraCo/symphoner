import { ClientPool } from "./clientPool";
import { Phase, Scenario } from "./models";
import { ClientEvent, EventMessage, Message, MessageSource } from "./message";
import { id } from "./id";
import { messageStream } from "./messageStream";
import {State} from "./state";
import {numberBetween} from "./utils";

export enum PhaseEvent {
	Started = "Phase:Started",
	Ended = "Phase:Ended",
}

/**
 * Orchestrates a phase and its execution. This component is in charge of starting the clients based on the phase's
 * configuration and picking the action each client will execute based on the scenario's probability
 */
export class PhaseOrchestrator implements MessageSource {
	static readonly type:string = "PhaseOrchestrator";

	/**
	 * Unique ID used by the component when sending messages
	 */
	readonly id:string = id();
	readonly type:string = PhaseOrchestrator.type;

	private _state:State;

	/**
	 * Promise that lets the component notify other components when the phase finished or errored out
	 */
	private _promise:Promise<any>;
	private _resolve:() => void;
	private _reject:( error:any ) => void;

	/**
	 * Map used to s
	 */
	private _scenariosProbabilities:Map<Scenario, number>;
	private _clientArrivalInterval:number | null = null;
	private _listeners:string[] = [];

	constructor( readonly phase:Phase, readonly clientPool:ClientPool = new ClientPool() ) {
		this._scenariosProbabilities = this._createScenariosProbabilitiesMap( phase.scenarios );

		this._state = State.IDLE;
	}

	async run() {
		if( this._state === State.RUNNING ) throw new Error( "The phase is already running" );
		if( this._state === State.CLOSED ) throw new Error( "The phase has already been closed" );

		this._state = State.RUNNING;

		// Create the promise that will be resolved/rejected based on the phase status and save the callbacks to use
		// them when needed
		this._promise = new Promise( ( resolve, reject ) => {
			this._resolve = resolve;
			this._reject = reject;
		} );

		this._registerListeners();
		this._startPhaseCycle();

		return this._promise;
	}

	/**
	 * Creates a {@link Map} populated with the provided {@link Scenario}s and their "effective" probability
	 * @param scenarios
	 * @private
	 */
	private _createScenariosProbabilitiesMap( scenarios:Scenario[] ):Map<Scenario, number> {
		const scenariosProbabilities:Map<Scenario, number> = new Map();

		// Instead of forcing users to specify scenarios with probabilities that sum to 100, we can sum all
		// probabilities to come up with the real total
		const total = scenarios
			.map( scenario => scenario.probability )
			.reduce( ( previous, current ) => previous + current, 0 );

		// Populate the map with the scenario and the effective probability
		scenarios.forEach( scenario => {
			const effectiveProbability = (scenario.probability * 100) / total;
			scenariosProbabilities.set( scenario, effectiveProbability );
		} );

		return scenariosProbabilities;
	}

	private _registerListeners():void {
		this._listeners.push( messageStream.addListener(
			[
				Message.isFrom( this.clientPool ),
				EventMessage.is,
				EventMessage.isOneOf( ClientEvent.Ready )
			],
			this._onClientReady.bind( this )
		) );
	}

	private _startPhaseCycle():void {
		this._addClient();

		// Start an interval to add the following client
		if( this.phase.clients > 1 ) this._clientArrivalInterval = setInterval( this._addClient.bind( this ), this.phase.arrivalRate );

		setTimeout( this._finishPhase.bind( this ), this.phase.duration );

		messageStream.emit( EventMessage.build( this, PhaseEvent.Started ) );
	}

	private _addClient():void {
		if( this.clientPool.size() < this.phase.clients ) this.clientPool.grow();

		// Is this the last client we should add?
		if( this._clientArrivalInterval && this.clientPool.size() >= this.phase.clients ) {
			clearInterval( this._clientArrivalInterval );
			this._clientArrivalInterval = null;
		}
	}

	private async _finishPhase() {
		await this.clientPool.close();

		this._removeListeners();

		messageStream.emit( EventMessage.build( this, PhaseEvent.Ended ) );

		this._state = State.CLOSED;

		this._resolve();
	}

	private _removeListeners() {
		this._listeners.forEach( messageStream.removeListener );
	}

	private _onClientReady( message:Message ) {
		const scenario:Scenario = this._pickScenario();

		this.clientPool.executeAction( scenario.action );
	}

	private _pickScenario():Scenario {
		const roll:number = numberBetween( 0, 100 );

		// Iterate over the scenarios and sum their probabilities until the sum is bigger or equal to the rolled number
		let sum:number = 0;
		for( let [ scenario, probability ] of this._scenariosProbabilities.entries() ) {
			sum = sum + probability;
			if( roll <= sum ) return scenario;
		}

		throw new Error( "The scenariosProbabilities map wasn't properly populated" );
	}
}
