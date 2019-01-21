import {MessageFilter} from "./messageStream";

/**
 * Object that describes what generated a {@link Message}
 */
export interface MessageSource {
	readonly id:string;
	readonly type:string;
}

export const MessageSource = {
	/**
	 * Creates a copy with only the relevant information that is safe to be serialized
	 * @param original
	 */
	of( original:MessageSource ):MessageSource {
		return {
			id: original.id,
			type: original.type,
		}
	}
};

/**
 * Basic message to be sent through a {@link MessageStream}
 */
export interface Message<T extends string = string> {
	readonly timestamp:Date;
	readonly type:T;
	readonly source:MessageSource;
}

export const Message = {
	/**
	 * Creates a {@link MessageFilter} that checks if the message has the given type
	 * @param type
	 */
	is( type:string ):MessageFilter {
		return message => message.type === type;
	},

	/**
	 * Creates a {@link MessageFilter} that checks if the message comes from the given source
	 * @param source
	 */
	isFrom( source:MessageSource ):MessageFilter {
		return Message.isFromAny( [ source ] );
	},

	/**
	 * Creates a {@link MessageFilter} that checks if the message comes from any of the given sources
	 * @param sources
	 */
	isFromAny( sources:MessageSource[] ):MessageFilter {
		return ( message:Message ):boolean => {
			for( let source of sources ) if( message.source.id === source.id && message.source.type === source.type ) return true;
			return false;
		};
	},

	/**
	 * Builds a {@link Message}
	 * @param type
	 * @param source
	 */
	build<T extends string>( type:T, source:MessageSource ):Message<T> {
		return {
			timestamp: new Date(),
			type,
			source,
		};
	}
};

/**
 * {@link Message} that represents an event
 */
export interface EventMessage extends Message {
	/**
	 * The type of event this message corresponds to (e.g. "Client:Started")
	 */
	readonly event:string;
	readonly type:"Event";
}

export const EventMessage = {
	// The value needs to be casted to "Event" to avoid problems when using the value (since it is not a const)
	type:"Event" as EventMessage["type"],

	/**
	 * {@link MessageFilter} that checks if the message has the type of an {@link EventMessage}
	 * @param message
	 */
	is( message:Message ):boolean {
		return message.type === EventMessage.type;
	},

	/**
	 * Creates a {@link MessageFilter} that checks if the message corresponds to any of the given events
	 * @param events
	 */
	isOneOf( ...events:string[] ):MessageFilter {
		return ( message:Message ):boolean => events.indexOf( (message as EventMessage).event ) !== - 1;
	},

	/**
	 * Builds a {@link EventMessage}
	 * @param source
	 * @param event
	 */
	build( source:MessageSource, event:string ):EventMessage {
		return {
			...Message.build( EventMessage.type, source ),
			event,
		};
	},
};

/**
 * {@link EventMessage} that comes from a {@link Client}
 */
export interface ClientEventMessage extends EventMessage {
	/**
	 * {@link MessageSource} that represents the {@link Client} that emitted the event (in case the event was
	 * retransmitted by another {@link MessageSource} like the {@link ClientWatcher}
	 */
	readonly client:MessageSource;
}

export const ClientEventMessage = {
	/**
	 * Creates a {@link ClientEventMessage}
	 * @param source
	 * @param originalMessage
	 */
	build(source: MessageSource, originalMessage:EventMessage ):ClientEventMessage {
		return {
			...EventMessage.build( source, originalMessage.event ),
			client:originalMessage.source,
		};
	},
};

export enum ClientEvent {
	Ready = "Client:Ready",
	Working = "Client:Working",
	Error = "Client:Error",
	ActionStarted = "Client:ActionStarted",
	ActionFinished = "Client:ActionFinished",
	ActionAborted = "Client:ActionAborted",
	ActionErrored = "Client:ActionErrored",
	Exited = "Client:Exited",
	Disconnected = "Client:Disconnected"
}
