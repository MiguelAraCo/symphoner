import { Symphoner } from "./index";
import { ClientWatcher } from "./clientWatcher";
import {ClientEvent, EventMessage, Message, MessageSource} from "./message";
import { messageStream } from "./messageStream";
import { id } from "./id";
import { CommandMessage, ExecuteActionCommand } from "./command";
import { statsd } from "./stats/statsd";

/**
 * Manages a pool of clients and distributes actions between them
 */
export class ClientPool {
	readonly id:string = id();
	readonly type:"ClientPool" = "ClientPool";

	private _size:number = 0;

	private _clientsRunning:ClientWatcher[] = [];
	private _clientsIdle:ClientWatcher[] = [];

	private _listeners:string[] = [];

	constructor() {
		this._registerListeners();
	}

	/**
	 * Grow the number of clients available
	 * @param clients - Number of clients to add to the pool
	 */
	grow( clients:number = 1 ) {
		this._size = this._size + clients;
		while( this._clientsRunning.length < this._size ) this._addClient();

		/*
			2019-01-21 @MiguelAraCo
			TODO[code-quality]: Move to a Reporter to abstract StatsD logic
		*/
		statsd.instance.gauge( "clients", this._size );
	}

	/**
	 * Shrink the size of the pool
	 * @param clients - Number of clients to remove from the pool
	 */
	shrink( clients:number = 1 ) {
		this._size = this._size - clients;
	}

	size():number {
		return this._size;
	}

	/**
	 * Returns the number of clients currently executing an action
	 */
	clientsWorking():number {
		return this._clientsRunning.length - this._clientsIdle.length;
	}

	/**
	 * Returns the number of clients ready to execute an action
	 */
	clientsIdle():number {
		return this._clientsIdle.length;
	}

	/**
	 * Executes an action on a random available client
	 * @param action
	 */
	executeAction( action:string ) {
		const client:ClientWatcher | undefined = this._clientsIdle.shift();

		if( ! client ) throw new Error( "There are no clients available to execute the action" );

		client.send( CommandMessage.build(
			this,
			ExecuteActionCommand.build( action, Symphoner.instance.configuration.settings || {} )
		) );
	}

	async close() {
		// Empty client pool
		this.shrink( this.size() );

		await Promise.all( this._clientsRunning.map( client => client.abort() ) );

		this._removeListeners();

		/*
			2019-01-21 @MiguelAraCo
			TODO[code-quality]: Move to a Reporter to abstract StatsD logic
		*/
		statsd.instance.gauge( "clients", 0 );
	}

	private _addClient() {
		this._clientsRunning.push( new ClientWatcher() );
	}

	private _registerListeners() {
		this._listeners.push( messageStream.addListener(
			[
				Message.isFromAny( this._clientsRunning ),
				EventMessage.is,
				EventMessage.isOneOf( ClientEvent.Disconnected, ClientEvent.Exited )
			],
			this._onClientLost.bind( this )
		) );
		this._listeners.push( messageStream.addListener(
			[
				Message.isFromAny( this._clientsRunning ),
				EventMessage.is,
				EventMessage.isOneOf( ClientEvent.Working )
			],
			this._onClientWorking.bind( this )
		) );
		this._listeners.push( messageStream.addListener(
			[
				Message.isFromAny( this._clientsRunning ),
				EventMessage.is,
				EventMessage.isOneOf( ClientEvent.Ready )
			],
			this._onClientReady.bind( this )
		) );
	}

	private _removeListeners() {
		this._listeners.forEach( messageStream.removeListener );
	}

	private _onClientLost( message:Message ) {
		{
			// Search for the client in the clientsRunning queue
			const index = this._clientsRunning.indexOf( (message.source) as ClientWatcher );
			if( index !== - 1 ) this._clientsRunning.splice( index, 1 );
		}
		{
			// Search for the client in the clientsIdle queue
			const index = this._clientsIdle.indexOf( (message.source) as ClientWatcher );
			if( index !== - 1 ) this._clientsIdle.splice( index, 1 );
		}

		while( this._clientsRunning.length < this._size ) this._addClient();
	}

	private _onClientReady( message:Message ) {
		this._clientsIdle.push( message.source as ClientWatcher );

		if( this.clientsWorking() < this.size() ) messageStream.emit( EventMessage.build( this, ClientEvent.Ready ) );
	}

	private _onClientWorking( message:Message ) {
		const index = this._clientsIdle.indexOf( (message.source) as ClientWatcher );
		if( index !== - 1 ) this._clientsIdle.splice( index, 1 );
	}
}
