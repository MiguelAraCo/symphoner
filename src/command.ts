import { Message, MessageSource } from "./message";

export interface Command {
	readonly name:string;
}

export class CommandMessage implements Message {
	static readonly type:string = "Command";

	readonly timestamp:Date = new Date();
	readonly type:string = CommandMessage.type;

	constructor( readonly source:MessageSource, readonly command:Command ) {}
}

export class ExecuteActionCommand implements Command {
	readonly name:string = "ExecuteAction";

	constructor( readonly action:string ) {}
}

export class AbortCommand implements Command {
	readonly name:string = "Abort";
}
