import { id } from "./id";
import { Message } from "./message";

export type MessageFilter = ( message:Message ) => boolean;
export type MessageListener = ( message:Message ) => any;
export type ListenerSpec = {
	filters:MessageFilter[],
	listener:MessageListener,
}

/**
 * Represents a stream of messages that can be listened to by other components.
 * <p>
 * It allows components to talk to each other indirectly by sharing a message bus where any component can emit new
 * messages and listen to messages being emitted.
 * <p>
 * Messages only need to implement the {@link Message} interface and are otherwise as flexible as they need to be.
 * <p>
 * Components can selectively listen to only specific messages by using {@link MessageFilter}s.
 * <p>
 * Listeners are executed <strong>synchronously<strong> in the order they were added to the stream.
 */
export class MessageStream {
	/**
	 * Maps registered {@link ListenerSpec} with their corresponding IDs
	 */
	private _listeners:Map<string, ListenerSpec> = new Map();

	constructor() {
		// FIXME: Is this really needed?
		// Bind this to this class' methods so they can be passed to other components safely
		this.addListener = this.addListener.bind( this );
		this.removeListener = this.removeListener.bind( this );
		this.emit = this.emit.bind( this );
	}

	/**
	 * Adds a new listener that will only be called if all the filters provided evaluate to true for any given message
	 * @param filters
	 * @param listener
	 */
	addListener( filters:MessageFilter[], listener:MessageListener ):string {
		const listenerID:string = id();
		this._listeners.set( listenerID, { filters, listener } );
		return listenerID;
	}

	/**
	 * Removes the listener registered with the provided id
	 * @param id
	 */
	removeListener( id:string ) {
		return this._listeners.delete( id );
	};

	/**
	 * Emits a new message in the message stream and immediately executes any {@link MessageListener} of which the
	 * related {@link MessageFilter}s pass.
	 * @param message
	 */
	emit( message:Message ) {
		this._listeners.forEach( ( { filters, listener }:ListenerSpec ) => {
			for( let filterFn of filters ) if( ! filterFn( message ) ) return;
			listener( message );
		} );
	}
}

/**
 * Singleton of {@link MessageStream} that can be reused by components
 */
export const messageStream:MessageStream = new MessageStream();
