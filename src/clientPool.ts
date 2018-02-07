import { ClientWatcher } from "./clientWatcher";
import { ClientEvent, EventMessage, Message } from "./message";
import { messageStream } from "./messageStream";
import { id } from "./id";
import { CommandMessage, ExecuteActionCommand } from "./command";
import { Symphoner } from "symphoner";

export interface ClientPoolConfiguration {

}

export class ClientPool {
	readonly id:string = id();
	readonly type:"ClientPool" = "ClientPool";

	private _size:number = 0;

	private _clients:ClientWatcher[] = [];
	private _clientsReady:ClientWatcher[] = [];

	private _listeners:string[] = [];

	constructor( configuration?:ClientPoolConfiguration ) {
		this._registerListeners();
	}

	grow( clients:number = 1 ):void {
		this._size = this._size + clients;
		while( this._clients.length < this._size ) this._addClient();
	}

	shrink( clients:number = 1, removeUnusedClients:boolean = false ):void {
		this._size = this._size - clients;
	}

	size():number {
		return this._size;
	}

	clientsWorking():number {
		return this._clients.length - this._clientsReady.length;
	}

	clientsReady():number {
		return this._clientsReady.length;
	}

	executeAction( action:string ):void {
		const client:ClientWatcher | undefined = this._clientsReady.shift();

		// TODO: Implement action queue
		if( ! client ) throw new Error( "There are no clients available to execute the action" );

		client.send( new CommandMessage( { id: this.id, type: this.type }, new ExecuteActionCommand( action, Symphoner.instance.configuration.settings || {} ) ) );
	}

	async close() {
		await Promise.all( this._clients.map( client => client.abort() ) );
		this._removeListeners();
	}

	private _addClient():void {
		this._clients.push( new ClientWatcher() );
	}

	private _registerListeners():void {
		this._listeners.push( messageStream.addListener(
			[
				Message.isFrom( this._clients ),
				EventMessage.is,
				EventMessage.isOneOf( ClientEvent.Disconnected, ClientEvent.Exited )
			],
			this._onClientLost
		) );
		this._listeners.push( messageStream.addListener(
			[
				Message.isFrom( this._clients ),
				EventMessage.is,
				EventMessage.isOneOf( ClientEvent.Working )
			],
			this._onClientWorking
		) );
		this._listeners.push( messageStream.addListener(
			[
				Message.isFrom( this._clients ),
				EventMessage.is,
				EventMessage.isOneOf( ClientEvent.Ready )
			],
			this._onClientReady
		) );
	}

	private _removeListeners():void {
		this._listeners.forEach( messageStream.removeListener );
	}

	private _onClientLost:( message:Message ) => void = (function( this:ClientPool, message:Message ):void {
		{
			const index = this._clients.indexOf( (message.source) as ClientWatcher );
			if( index !== - 1 ) this._clients.splice( index, 1 );
		}
		{
			const index = this._clientsReady.indexOf( (message.source) as ClientWatcher );
			if( index !== - 1 ) this._clientsReady.splice( index, 1 );
		}

		while( this._clients.length < this._size ) this._addClient();
	}).bind( this );

	private _onClientReady:( message:Message ) => void = (function( this:ClientPool, message:Message ):void {
		this._clientsReady.push( message.source as ClientWatcher );

		if( this.clientsWorking() < this.size() ) messageStream.emit( new EventMessage( this, ClientEvent.Ready ) );
	}).bind( this );

	private _onClientWorking:( message:Message ) => void = (function( this:ClientPool, message:Message ):void {
		const index = this._clientsReady.indexOf( (message.source) as ClientWatcher );
		if( index !== - 1 ) this._clientsReady.splice( index, 1 );
	}).bind( this );
}
