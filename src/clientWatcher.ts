import { ChildProcess, fork } from "child_process";
import time from "./time";
import { ClientEvent, ClientEventMessage, ClientExitedMessage, CommandMessage, EventMessage, Message } from "./message";
import { AbortCommand } from "./command";
import { MessageEmitter } from "./models";

export interface ClientWatcherConfiguration {
	timeout?:number;
	abortTimeout?:number;
	clientScript?:string;
}

const defaultConfiguration:ClientWatcherConfiguration = {
	timeout: time( 1 ).minutes,
	abortTimeout: time( 5 ).seconds,
	clientScript: __dirname + "/client",
};

interface CompleteConfiguration extends ClientWatcherConfiguration {
	timeout:number;
	abortTimeout:number;
	clientScript:string;
}

export class ClientWatcher extends MessageEmitter {
	private _client:ChildProcess;
	private readonly _configuration:CompleteConfiguration;
	private _timeoutID:number;
	private _abortTimeoutID:number;

	send( message:Message ) {
		this._client.send( message );
	}

	constructor( configuration?:ClientWatcherConfiguration ) {
		super();

		this._configuration = <CompleteConfiguration> Object.assign( {}, defaultConfiguration, configuration );

		this._startClient();
		this._registerHandlers();
		this._registerTimeout();
	}

	private _startClient():void {
		this._client = fork( this._configuration.clientScript );
	}

	private _registerHandlers():void {
		this._client.on( "message", this._handleMessage.bind( this ) );
		this._client.on( "disconnect", () => this.emit( "message", new EventMessage( ClientEvent.Disconnected ) ) );
		this._client.on( "exit", ( code, signal ) => this.emit( "message", new ClientExitedMessage( code, signal ) ) );
	}

	protected _handleEventMessage( message:EventMessage ):void {
		switch( message.event ) {
			case ClientEvent.ActionFinished:
			case ClientEvent.Disconnected:
			case ClientEvent.Exited:
				this._clearTimeouts();
				break;
			case ClientEvent.Ready:
				message = new ClientEventMessage( this, message );
				break;
		}
		this.emit( "message", message );
	}

	private _registerTimeout():void {
		this._timeoutID = setTimeout( this._handleTimeout.bind( this ), this._configuration.timeout );
	}

	private _clearTimeouts():void {
		if( this._configuration.timeout != undefined ) clearTimeout( this._timeoutID );
		if( this._configuration.abortTimeout != undefined ) clearTimeout( this._abortTimeoutID );
	}

	private _handleTimeout():void {
		this._client.send( new CommandMessage( new AbortCommand() ) );
		this._abortTimeoutID = setTimeout( this._handleAbortTimeout.bind( this ), this._configuration.abortTimeout );
	}

	private _handleAbortTimeout():void {
		this._client.kill( "SIGKILL" );
	}
}
