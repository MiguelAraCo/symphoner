import { StatsD } from "node-statsd";

import { Test } from "./models";
import { PhaseEvent, PhaseOrchestrator } from "./phaseOrchestrator";
import { messageStream } from "./messageStream";
import { EventMessage } from "./message";
import { ActionReporter, PhaseReporter } from "./reporters";
import { statsd } from "./stats/statsd";
import {State} from "./state";

export interface StatsDConfiguration {
	host:string;
	port:number;
	prefix?:string;
	suffix?:string;
	global_tags?:string[];
}

export interface SymphonerConfiguration {
	statsd:StatsDConfiguration;
	settings?:{ [name:string]:any };
}

export class Symphoner {
	private static _instance:Symphoner | null = null;
	static get instance():Symphoner {
		if( Symphoner._instance === null ) throw new Error( "Symphoner hasn't been initialized" );
		return Symphoner._instance;
	}

	private _state:State;

	private _orchestrators:PhaseOrchestrator[];

	private _loggerListenerID:string;

	private _phaseReporter:PhaseReporter;
	private _actionReporter:ActionReporter;

	constructor( public configuration:SymphonerConfiguration ) {
		if( Symphoner._instance !== null ) throw new Error( "An instance has been previously created" );
		Symphoner._instance = this;

		this._init();

		this._state = State.IDLE;
	}

	/**
	 * Runs the specified {@link Test} and returns a promise that will be resolved once the test finishes or rejected
	 * once it errors out.
	 * @param test
	 */
	async run( test:Test ):Promise<void> {
		if( this._state === State.RUNNING ) throw new Error( "A test is already running" );
		if( this._state === State.CLOSED ) throw new Error( "This Symphoner instance has already been closed" );
		this._state = State.RUNNING;

		// TODO: Reuse client pools
		this._orchestrators = test.phases.map( phase => new PhaseOrchestrator( phase ) );

		// Create a promise that will resolve once all phases have been executed, or reject if any of them errors out
		try {
			await this._orchestrators.reduce(
				// Start the next phase as soon as the previous phase finishes
				(previous, current) => previous.then(() => current.run()),
				// Start the Promise chain with a resolved promise
				Promise.resolve()
			);
		} finally {
			this._state = State.IDLE;
		}
	}

	/**
	 * Cleans the environment of Symphoner's side effects and frees whatever resource needs to be freed.
	 * <p>
	 * After executing this, this Symphoner instance can't be used again
	 */
	close() {
		statsd.close();

		messageStream.removeListener( this._loggerListenerID );
		this._phaseReporter.close();
		this._actionReporter.close();

		Symphoner._instance = null;
	}

	private _init() {
		statsd.instance = new StatsD( this.configuration.statsd );

		/*
			2019-01-18 @MiguelAraCo
			TODO[improvement]: Move this to a component specialized in logging the status of Symphoner
		*/
		this._loggerListenerID = messageStream.addListener( [
			EventMessage.is,
			EventMessage.isOneOf( PhaseEvent.Started, PhaseEvent.Ended ),
		], message => {
			const logMessage = `${message.timestamp.getHours()}:${message.timestamp.getMinutes()}:${message.timestamp.getSeconds()}:${message.timestamp.getMilliseconds()} - ${message.source.type}#${message.source.id}: ${message.type}{${(message as EventMessage).event}}`;

			console.log( logMessage );
		} );

		// Initialize reporters so they start reporting stats to statsd
		this._phaseReporter = new PhaseReporter().init();
		this._actionReporter = new ActionReporter().init();
	}
}
