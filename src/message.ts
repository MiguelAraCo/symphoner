import { Command } from "./command";
import { ClientWatcher } from "./clientWatcher";

export interface Message {
	readonly type:string;
}

export class EventMessage implements Message {
	readonly type:"Event" = "Event";

	constructor( readonly event:string ) {}
}

export class ClientEventMessage extends EventMessage {
	constructor( readonly client:ClientWatcher, originalMessage:EventMessage ) {
		super( originalMessage.event );
	}
}

export enum ClientEvent {
	Ready = "Client:Ready",
	ActionStarted = "Client:ActionStarted",
	ActionFinished = "Client:ActionFinished",
	ActionAborted = "Client:ActionAborted",
	Exited = "Client:Exited",
	Disconnected = "Client:Disconnected"
}

export class ClientExitedMessage extends EventMessage {
	constructor( readonly code:number, readonly signal:string ) {
		super( ClientEvent.Exited );
	}
}

export class CommandMessage implements Message {
	readonly type:"Command" = "Command";

	constructor( readonly command:Command ) {}
}
