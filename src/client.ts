import { promisify } from "util";
import { stat as _stat, Stats } from "fs";

const stat:( file:string ) => Promise<Stats> = <any>promisify( _stat );

import { process } from "./forkedProcess";
import { EventMessage, ClientEvent, MessageSource } from "./message";
import { AbortCommand, Command, CommandMessage, ExecuteActionCommand } from "./command";
import { id } from "./id";


export class Client implements MessageSource {
	static readonly type:string = "Client";

	readonly id:string = id();
	readonly type:string = Client.type;

	private _waiting:boolean = true;

	async init() {
		this._register();
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

		process.send( new EventMessage( { id: this.id, type: this.type }, ClientEvent.ActionStarted ) );

		let actionResult;
		try {
			actionResult = action();
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
		}

		process.send( new EventMessage( { id: this.id, type: this.type }, ClientEvent.ActionFinished ) );

		this._reset();
	}

	private _register():void {
		process.on( "message", this._handleMessage.bind( this ) );
		this._reset();

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
		if( ! this._waiting ) {
			console.log( "The client is already executing an action" );
			return;
		}

		await this.start( command );
	}

	private async _handleAbortCommand( command:AbortCommand ) {
		if( this._waiting ) return;

		process.send( new EventMessage( { id: this.id, type: this.type }, ClientEvent.ActionAborted ) );

		setTimeout( () => process.exit( 0 ), 0 );
	}

	private async _handleActionsError( action:string, error:any ) {
		console.error( "ERROR: There was an error while executing the action's script '%s'. Error:\n\t%o", action, error );
	}
}

(new Client()).init().catch( error => console.error( "ERROR! The client script has encountered an unexpected error:\n%e", error ) );
