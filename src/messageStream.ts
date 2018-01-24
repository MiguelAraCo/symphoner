import * as uuid from "uuid/v4";

export type FilterFn = ( message:any ) => boolean;
export type ListenerFn = ( message:any ) => any;

export class MessageStream {
	public static readonly instance:MessageStream = new MessageStream();

	private _listeners:Map<string, [ FilterFn, ListenerFn ]> = new Map();

	constructor() {}

	addListener( filter:FilterFn, listener:ListenerFn ):string {
		const listenerID:string = uuid();
		this._listeners.set( listenerID, [ filter, listener ] );
		return listenerID;
	}

	removeListener( listenerID:string ):boolean {
		return this._listeners.delete( listenerID );
	}

	emit( message:any ) {
		this._listeners.forEach( ( [ filter, listener ]:[ FilterFn, ListenerFn ] ) => filter( message ) ? listener( message ) : void 0 );
	}
}
