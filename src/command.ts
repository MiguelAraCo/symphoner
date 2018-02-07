import { Message, MessageSource } from "./message";
import { StatsDConfiguration } from "symphoner";

export interface Command {
	readonly name:string;
}

export class CommandMessage implements Message {
	static readonly type:string = "Command";

	readonly timestamp:Date = new Date();
	readonly type:string = CommandMessage.type;

	constructor( readonly source:MessageSource, readonly command:Command ) {}
}

export interface ClientConfig {
	statsd:StatsDConfiguration;
}

export class InitializeClientCommand implements Command {
	readonly name:string = "InitializeClient";

	constructor( readonly config:ClientConfig ) {}
}

export class ExecuteActionCommand implements Command {
	readonly name:string = "ExecuteAction";

	constructor( readonly action:string ) {}
}

export class AbortCommand implements Command {
	readonly name:string = "Abort";
}
