import { Command } from "./command";

export class EventMessage {
	readonly type:"Event" = "Event";

	constructor( readonly event:string ) {}
}

export class CommandMessage {
	readonly type:"Command" = "Command";

	constructor( readonly command:Command ) {}
}
