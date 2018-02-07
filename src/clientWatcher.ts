import { ChildProcess, fork } from "child_process";
import time from "./time";
import { ClientEvent, ClientEventMessage, EventMessage, Message, MessageSource } from "./message";
import { AbortCommand, CommandMessage, InitializeClientCommand } from "./command";
import { id } from "./id";
import { messageStream } from "./messageStream";
import { statsd } from "./stats/statsd";

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

export class ClientWatcher implements MessageSource {
	static readonly type:string = "ClientWatcher";

	readonly id:string = id();
	readonly type:string = ClientWatcher.type;

	private readonly _configuration:CompleteConfiguration;

	private _client:ChildProcess;
	private _timeoutID:number;
	private _abortTimeoutID:number;

	send( message:Message ) {
		this._client.send( message );
	}

	constructor( configuration?:ClientWatcherConfiguration ) {
		this._configuration = <CompleteConfiguration> Object.assign( {}, defaultConfiguration, configuration );

		this._startClient();
		this._registerListeners();
		this._registerTimeout();
		this._initializeClient();
	}

	async abort() {
		// TODO: Refactor this mess
		// TODO: Give some time to the pending action to finish before aborting (that way clients can be reused)
		// TODO: Abort only if the client isn't in a waiting state
		// TODO: Solve the problem with the kill signal (the _reset method is removing the timeout)
		return new Promise( ( resolve, reject ) => {
			let onClientShutdown = (function onClientShutdown( this:ClientWatcher ) {
				this._client.removeListener( "disconnect", onClientShutdown );
				this._client.removeListener( "exit", onClientShutdown );

				this._close();

				resolve();
			}).bind( this );

			this._clearListeners();
			this._client.addListener( "message", this._onMessage );
			this._client.addListener( "disconnect", onClientShutdown );
			this._client.addListener( "exit", onClientShutdown );

			this._abortTimeoutID = setTimeout( (function( this:ClientWatcher ) {
				this._client.removeListener( "disconnect", onClientShutdown );
				this._client.removeListener( "exit", onClientShutdown );

				this._client.kill( "SIGKILL" );
				this._close();

				resolve();
			}).bind( this ), this._configuration.abortTimeout );

			this._client.send( new CommandMessage( { id: this.id, type: this.type }, new AbortCommand() ) );
		} );
	}

	private _startClient():void {
		this._client = fork( this._configuration.clientScript );
	}

	private _initializeClient():void {
		this._client.send( new CommandMessage( { id: this.id, type: this.type }, new InitializeClientCommand( {
			statsd: {
				host: statsd.instance.host,
				port: statsd.instance.port,
				prefix: statsd.instance.prefix,
				suffix: statsd.instance.suffix,
				global_tags: statsd.instance.global_tags,
			}
		} ) ) );
	}

	private _registerListeners():void {
		this._client.on( "message", this._onMessage );
		this._client.on( "disconnect", this._onClientDisconnect );
		this._client.on( "exit", this._onClientExit );
	}

	private _clearListeners():void {
		this._client.removeListener( "message", this._onMessage );
		this._client.removeListener( "disconnect", this._onClientDisconnect );
		this._client.removeListener( "exit", this._onClientExit );
	}

	private _onMessage:( message:any ) => void = (function( this:ClientWatcher, message:any ):void {
		if( ! message ) return;
		if( typeof message !== "object" ) return;
		if( ! ("type" in message) ) return;

		switch( message.type ) {
			case "Event":
				this._onEventMessage( message as EventMessage );
				break;
			default:
				// TODO: Should it be broadcasted?
				break;
		}
	}).bind( this );

	private _onEventMessage( message:EventMessage ):void {
		switch( message.event ) {
			// TODO: Add action error events
			case ClientEvent.ActionFinished:
				this._reset();
				break;
			case ClientEvent.Ready:
				message = new ClientEventMessage( this, message );
				break;
		}
		messageStream.emit( {
			type: EventMessage.type,
			timestamp: new Date( message.timestamp ),
			source: this,
			event: message.event
		} as EventMessage );
	}

	private _onClientDisconnect:() => void = (function( this:ClientWatcher ):void {
		messageStream.emit( new EventMessage( this, ClientEvent.Disconnected ) );
		this._close();
	}).bind( this );

	private _onClientExit:() => void = (function( this:ClientWatcher ):void {
		messageStream.emit( new EventMessage( this, ClientEvent.Exited ) );
		this._close();
	}).bind( this );

	private _registerTimeout():void {
		this._timeoutID = setTimeout( this.abort.bind( this ), this._configuration.timeout );
	}

	private _reset():void {
		this._clearTimeouts();
	}

	private _close():void {
		this._clearTimeouts();
		this._clearListeners();
	}

	private _clearTimeouts():void {
		if( this._configuration.timeout != undefined ) clearTimeout( this._timeoutID );
		if( this._configuration.abortTimeout != undefined ) clearTimeout( this._abortTimeoutID );
	}
}
