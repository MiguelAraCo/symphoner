import { promisify } from "util";
import { stat as _stat, Stats } from "fs";
import { StatsD } from "node-statsd";

import { process } from "./forkedProcess";
import { ClientEvent, EventMessage, MessageSource } from "./message";
import { AbortCommand, Command, CommandMessage, ExecuteActionCommand, InitializeClientCommand } from "./command";
import { id } from "./id";
import { inspect } from "./httpInspector";
import { Timestamp, Timestamps } from "./time";
import { statsd } from "./stats/statsd";

const stat:( file:string ) => Promise<Stats> = <any>promisify( _stat );

class ActionTimestamps extends Timestamps {
	finished:Timestamp = [ 0, 0 ];
}

export class Client implements MessageSource {
	static readonly type:string = "Client";

	readonly id:string = id();
	readonly type:string = Client.type;

	private _waiting:boolean = false;

	async listen() {
		this._register();
	}

	async init( command:InitializeClientCommand ) {
		statsd.instance = new StatsD( command.config.statsd );

		inspect( statsd.instance );

		this._reset();
	}

	async start( command:ExecuteActionCommand ) {
		this._waiting = false;
		process.send( new EventMessage( { id: this.id, type: this.type }, ClientEvent.Working ) );

		let stats:Stats;
		try {
			stats = await stat( command.action );
		} catch( error ) {
			console.error( "ERROR: Couldn't open action's file:\n\t%o", error );
			// FIXME
			return;
		}

		if( ! stats.isFile() ) {
			console.error( "ERROR: The path registered for this action: '%s' isn't a file", command.action );
			// FIXME
			return;
		}

		let action;
		try {
			action = require( command.action );
		} catch( error ) {
			console.error( "ERROR: Couldn't require action's script '%s':\n\t%o", command.action, error );
			// FIXME
			return;
		}

		if( typeof action !== "function" ) {
			console.error( "ERROR: The action's script '%s' doesn't export a function", command.action );
			// FIXME
			return;
		}

		const timestamps:ActionTimestamps = new ActionTimestamps();
		process.send( new EventMessage( { id: this.id, type: this.type }, ClientEvent.ActionStarted ) );

		let actionResult;
		try {
			actionResult = action( statsd.instance );
		} catch( error ) {
			await this._handleActionsError( command.action, error );
			return;
		}

		actionResult = ! actionResult || ! ("then" in actionResult) ? Promise.resolve( actionResult ) : actionResult;

		try {
			await actionResult;
		} catch( error ) {
			await this._handleActionsError( command.action, error );
			return;
		} finally {
			timestamps.finished = process.hrtime();

			const finished:number = ActionTimestamps.ms( timestamps.finished, timestamps.created );
			statsd.instance.timing( "action.duration", finished );
		}

		statsd.instance.increment( "actions.success" );
		process.send( new EventMessage( { id: this.id, type: this.type }, ClientEvent.ActionFinished ) );

		this._reset();
	}

	private _register():void {
		process.on( "message", this._handleMessage.bind( this ) );

	}

	private _reset():void {
		this._waiting = true;
		process.send( new EventMessage( { id: this.id, type: this.type }, ClientEvent.Ready ) );
	}

	private async _handleMessage( message:any ) {
		if( ! message || typeof message !== "object" || typeof message.type !== "string" ) {
			console.log( "Unrecognized message:\n\t%o", message );
			return;
		}

		switch( message.type ) {
			case "Event":
				await this._handleEventMessage( message );
				break;
			case "Command":
				await this._handleCommandMessage( message );
				break;
			default:
				console.log( "Unrecognized message:\n\t%o", message );
				break;
		}
	}

	private async _handleEventMessage( message:EventMessage ) {
		switch( message.event ) {
			default:
				break;
		}
	}

	private async _handleCommandMessage( message:CommandMessage ) {
		switch( message.command.name ) {
			case "InitializeClient":
				await this.init( message.command as InitializeClientCommand );
				break;
			case "ExecuteAction":
				await this._handleExecuteAction( message.command as ExecuteActionCommand );
				break;
			case "Abort":
				await this._handleAbortCommand( message.command as AbortCommand );
				break;
			default:
				break;
		}
	}

	private async _handleExecuteAction( command:ExecuteActionCommand ) {
		if( ! this._waiting ) return;

		await this.start( command );
	}

	private async _handleAbortCommand( command:AbortCommand ) {
		if( this._waiting ) return;

		process.send( new EventMessage( { id: this.id, type: this.type }, ClientEvent.ActionAborted ) );

		setTimeout( () => process.exit( 0 ), 0 );
	}

	private async _handleActionsError( action:string, error:any ) {
		process.send( new EventMessage( { id: this.id, type: this.type }, ClientEvent.ActionErrored ) );

		statsd.instance.increment( "actions.error" );

		this._reset();
	}
}

(new Client()).listen().catch( error => console.error( "ERROR! The client script has encountered an unexpected error:\n%e", error ) );
