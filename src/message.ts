export class Message {
	static is( type:string ):( message:Message ) => boolean {
		return message => message.type === type;
	}

	static isOneOf( ...types:string[] ):( message:Message ) => boolean {
		return ( message:Message ):boolean => types.indexOf( (message as EventMessage).event ) !== - 1;
	}

	static isFrom( sources:MessageSource[] ):( message:Message ) => boolean {
		return ( message:Message ):boolean => {
			for( let source of sources ) if( message.source.id === source.id && message.source.type === source.type ) return true;
			return false;
		};
	}

	readonly timestamp:Date = new Date();

	constructor( readonly type:string, readonly source:MessageSource ) {}
}

export interface MessageSource {
	id:string;
	type:string;
}

export class EventMessage implements Message {
	static readonly type:string = "Event";

	static is( message:Message ):boolean {
		return message.type === EventMessage.type;
	}

	static isOneOf( ...events:string[] ):( message:Message ) => boolean {
		return ( message:Message ):boolean => events.indexOf( (message as EventMessage).event ) !== - 1;
	}

	readonly timestamp:Date = new Date();
	readonly type:string = EventMessage.type;

	constructor( readonly source:MessageSource, readonly event:string ) {}
}

export class ClientEventMessage extends EventMessage {
	constructor( readonly source:MessageSource, originalMessage:EventMessage ) {
		super( source, originalMessage.event );
	}
}

export enum ClientEvent {
	Ready = "Client:Ready",
	Working = "Client:Working",
	ActionStarted = "Client:ActionStarted",
	ActionFinished = "Client:ActionFinished",
	ActionAborted = "Client:ActionAborted",
	Exited = "Client:Exited",
	Disconnected = "Client:Disconnected"
}

export class ClientExitedMessage extends EventMessage {
	constructor( readonly source:MessageSource, readonly code:number, readonly signal:string ) {
		super( source, ClientEvent.Exited );
	}
}
