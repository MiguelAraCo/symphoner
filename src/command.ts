import { StatsDConfiguration } from "./index";
import {Message, MessageSource} from "./message";
import {ObjectMap} from "./models";

export interface Command<T extends string = string> {
	readonly name:T;
}

export const Command = {
	build<T extends string>( name:T ) {
		return {
			name,
		};
	},
};

export interface CommandMessage extends Message {
	readonly type:"Command";

	readonly command:Command;
}

export const CommandMessage = {
	// The value needs to be casted to "Command" to avoid problems when using the value (since it is not a const)
	type:"Command" as CommandMessage["type"],

	build( source:MessageSource, command:Command ):CommandMessage {
		return {
			...Message.build( CommandMessage.type, source ),
			command,
		};
	},
};

export interface ClientConfig {
	statsd:StatsDConfiguration;
}

export interface InitializeClientCommand extends Command {
	readonly name:"InitializeClient";
	readonly config:ClientConfig;
}

export const InitializeClientCommand = {
	// The value needs to be casted to "InitializeClient" to avoid problems when using the value (since it is not a const)
	name:"InitializeClient" as InitializeClientCommand["name"],

	build( config:ClientConfig ) {
		return {
			...Command.build( InitializeClientCommand.name ),
			config,
		};
	},
};

export interface ExecuteActionCommand extends Command {
	readonly name:"ExecuteAction";
	readonly action:string;
	readonly settings:ObjectMap;
}

export const ExecuteActionCommand = {
	// The value needs to be casted to "ExecuteAction" to avoid problems when using the value (since it is not a const)
	name:"ExecuteAction" as ExecuteActionCommand["name"],

	build( action:string, settings:ObjectMap ) {
		return {
			...Command.build( ExecuteActionCommand.name ),
			action,
			settings,
		};
	},
};

export interface AbortCommand extends Command {
	readonly name:"Abort";
}

export const AbortCommand = {
	// The value needs to be casted to "Abort" to avoid problems when using the value (since it is not a const)
	name:"Abort" as AbortCommand["name"],

	build():AbortCommand {
		return {
			...Command.build( AbortCommand.name ),
		};
	},
};
