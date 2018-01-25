import { id } from "./id";
import { Message } from "./message";

export type FilterPipe = ( ( message:Message ) => boolean ) | (( message:Message ) => boolean)[];
export type ListenerFn = ( message:Message ) => any;

export class MessageStream {
	private _listeners:Map<string, [ FilterPipe, ListenerFn ]> = new Map();

	constructor() {}

	addListener:( filterPipe:FilterPipe, listener:ListenerFn ) => string = (function( this:MessageStream, filterPipe:FilterPipe, listener:ListenerFn ):string {
		const listenerID:string = id();
		this._listeners.set( listenerID, [ filterPipe, listener ] );
		return listenerID;
	}).bind( this );

	removeListener:( listenerID:string ) => boolean = (function( this:MessageStream, listenerID:string ):boolean {
		return this._listeners.delete( listenerID );
	}).bind( this );

	emit:( message:Message ) => void = (function( this:MessageStream, message:Message ):void {
		this._listeners.forEach( ( [ filterPipe, listener ]:[ FilterPipe, ListenerFn ] ) => {
			if( Array.isArray( filterPipe ) ) {
				for( let filterFn of filterPipe ) if( ! filterFn( message ) ) return;
			} else {
				if( ! filterPipe( message ) ) return;
			}
			listener( message );
		} );
	}).bind( this );
}


export const messageStream:MessageStream = new MessageStream();
