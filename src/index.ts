import { Test } from "./models";
import { PhaseEvent, PhaseOrchestrator } from "./phaseOrchestrator";
import { messageStream } from "./messageStream";
import { EventMessage } from "./message";
import { StatsD } from "node-statsd";
import { ActionReporter, PhaseReporter } from "./reporters";

export interface StatsDConfiguration {
	host:string;
	port:number;
	prefix?:string;
	suffix?:string;
	global_tags?:string[];
}

export interface SymphonerConfiguration {
	statsd:StatsDConfiguration;
}

export class Symphoner {
	private _statsd:StatsD;

	private _running:boolean = false;
	private _test:Test;
	private _orchestrators:PhaseOrchestrator[];

	private _phaseReporter:PhaseReporter;
	private _actionReporter:ActionReporter;

	constructor( private configuration:SymphonerConfiguration ) {
		this._statsd = new StatsD( this.configuration.statsd );

		messageStream.addListener( [
			EventMessage.is,
			EventMessage.isOneOf( PhaseEvent.Started, PhaseEvent.Ended )
		], message => {
			if( ! ("getHours" in message.timestamp) ) console.log( message );

			let logMessage = `${message.timestamp.getHours()}:${message.timestamp.getMinutes()}:${message.timestamp.getSeconds()}:${message.timestamp.getMilliseconds()} - ${message.source.type}#${message.source.id}: ${message.type}`;
			if( EventMessage.is( message ) ) logMessage += `{${(message as EventMessage).event}}`;

			console.log( logMessage );
		} );
	}

	async run( test:Test ) {
		this._test = test;

		this._phaseReporter = new PhaseReporter( this._statsd ).init();
		this._actionReporter = new ActionReporter( this._statsd ).init();

		// TODO: Reuse client pools
		this._orchestrators = test.phases.map( phase => new PhaseOrchestrator( phase ) );

		try {
			await this._orchestrators.reduce( ( previous, current ) => previous.then( () => current.run() ), Promise.resolve() );
		} finally {
			this._close();
		}
	}

	private _close:() => void = (function( this:Symphoner ):void {
		this._phaseReporter.close();
		this._actionReporter.close();
	}).bind( this );
}
