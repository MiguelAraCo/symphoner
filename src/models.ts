import { ClientEvent, ClientExitedMessage, CommandMessage, EventMessage, Message } from "./message";
import { EventEmitter } from "events";

export interface Scenario {
	distribution:number;
	action:string;
}

export interface Phase {
	duration:number;
	clients:number;
	arrivalRate:number;
	scenarios:Scenario[];
}

export interface Test {
	phases:Phase[];
}

export class MessageEmitter extends EventEmitter {
	protected _handleMessage( message:Message ):void {
		if( ! message ) return;
		if( typeof message !== "object" ) return;
		if( ! ("type" in message) ) return;

		switch( message.type ) {
			case "Event":
				this._handleEventMessage( message as EventMessage );
				break;
			case "Command":
				this._handleCommandMessage( message as CommandMessage );
				break;
			default:
				break;
		}
	}

	protected _handleEventMessage( message:EventMessage ):void {
		this.emit( "message", message );
	}

	protected _handleCommandMessage( message:CommandMessage ):void {
		this.emit( "message", message );
	}
}
