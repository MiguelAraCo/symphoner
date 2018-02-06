import { ClientEvent, EventMessage, Message } from "./message";
import { StatsD } from "node-statsd";
import { messageStream } from "./messageStream";
import { PhaseEvent } from "./phaseOrchestrator";

export abstract class AbstractReporter {
	protected _statsd:StatsD;
	protected _listeners:string[] = [];

	constructor( statsd:StatsD ) {
		this._statsd = statsd;
	}

	init():this {
		this._registerListeners();

		return this;
	}

	close():void {
		this._removeListeners();
	}

	protected abstract _registerListeners():string[];

	protected _removeListeners():void {
		if( ! this._listeners ) return;

		this._listeners.forEach( messageStream.removeListener );
		this._listeners = [];
	}
}

export class PhaseReporter extends AbstractReporter {
	private _phaseStarted:Date | null;

	constructor( statsd:StatsD ) {
		super( statsd );
	}

	protected _registerListeners():string[] {
		return [
			messageStream.addListener(
				[
					EventMessage.is,
					EventMessage.isOneOf( PhaseEvent.Started ),
				]
				, this._onPhaseStarted
			),
			messageStream.addListener(
				[
					EventMessage.is,
					EventMessage.isOneOf( PhaseEvent.Ended ),
				]
				, this._onPhaseEnded
			),
		];
	}

	private _onPhaseStarted:( message:Message ) => void = (function( this:PhaseReporter, message:Message ) {
		this._phaseStarted = message.timestamp;
	}).bind( this );

	private _onPhaseEnded:( message:Message ) => void = (function( this:PhaseReporter, message:Message ) {
		if( ! this._phaseStarted ) return;

		const duration:number = this._phaseStarted.getMilliseconds() - message.timestamp.getMilliseconds();

		this._statsd.timing( "symphoner.phase.duration", duration );
	}).bind( this );
}

export class ActionReporter extends AbstractReporter {
	constructor( statsd:StatsD ) {
		super( statsd );
	}

	protected _registerListeners():string[] {
		return [
			messageStream.addListener(
				[
					EventMessage.is,
					EventMessage.isOneOf( ClientEvent.ActionStarted ),
				],
				this._onActionStarted
			),
			messageStream.addListener(
				[
					EventMessage.is,
					EventMessage.isOneOf( ClientEvent.ActionFinished, ClientEvent.ActionAborted ),
				],
				this._onActionEnded
			),
		];
	}

	private _onActionStarted:( message:Message ) => void = (function( this:ActionReporter, message:Message ) {
		this._statsd.increment( "symphoner.actions" );
	}).bind( this );

	private _onActionEnded:( message:Message ) => void = (function( this:ActionReporter, message:Message ) {

	}).bind( this );
}
