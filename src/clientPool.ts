import { ClientWatcher } from "./clientWatcher";
import { MessageEmitter } from "./models";
import { ClientEvent, CommandMessage, EventMessage, Message } from "./message";

export interface ClientPoolConfiguration {

}

export class ClientPool extends MessageEmitter {
	private _clients:ClientWatcher[] = [];

	constructor( configuration?:ClientPoolConfiguration ) {
		super();
	}

	grow():void {
		const client:ClientWatcher = new ClientWatcher();

		this._registerHandlers( client );

		this._clients.push( client );
	}

	size():number {
		return this._clients.length;
	}

	private _registerHandlers( client:ClientWatcher ):void {
		client.on( "message", this._handleClientMessage.bind( this, client ) );
	}

	private _handleClientMessage( client:ClientWatcher, message:Message ):void {
		if( this._clients.indexOf( client ) === - 1 ) return;

		if( ! message ) return;
		if( typeof message !== "object" ) return;
		if( ! ("type" in message) ) return;

		switch( message.type ) {
			case "Event":
				this._handleClientEventMessage( message as EventMessage, client );
				break;
			default:
				this.emit( "message", message );
				break;
		}
	}

	private _handleClientEventMessage( message:EventMessage, client:ClientWatcher ):void {
		switch( message.event ) {
			case ClientEvent.Disconnected:
			case ClientEvent.Exited:
				this._handleClientLost( message, client );
				break;
		}

		this.emit( "message", message );
	}

	private _handleClientLost( message:EventMessage, client:ClientWatcher ):void {
		this._clients.splice( this._clients.indexOf( client ), 1 );
	}
}
