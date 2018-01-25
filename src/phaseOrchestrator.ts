import { ClientPool } from "./clientPool";
import { Phase, Scenario } from "./models";
import { ClientEvent, EventMessage, Message, MessageSource } from "./message";
import { id } from "./id";
import { messageStream } from "./messageStream";

export interface PhaseOrchestratorConfiguration {

}

export class PhaseOrchestrator implements MessageSource {
	static readonly type:string = "PhaseOrchestrator";

	private static _getRandomNumber( min:number, max:number ):number {
		return Math.random() * (max - min + 1) + min;
	}

	readonly id:string = id();
	readonly type:string = PhaseOrchestrator.type;

	private _scenariosDistribution:Map<Scenario, number>;
	private _clientArrivalInterval:number | null = null;
	private _listeners:string[] = [];

	constructor( readonly phase:Phase, readonly clientPool:ClientPool = new ClientPool(), configuration?:PhaseOrchestratorConfiguration ) {
		this._scenariosDistribution = this._createScenariosDistributionMap( phase.scenarios );
	}

	async start() {
		this._registerListeners();
		this._startPhaseCycle();
	}

	private _startPhaseCycle():void {
		if( this.phase.clients > 1 ) this._clientArrivalInterval = setInterval( this._addClient.bind( this ), this.phase.arrivalRate );
		this._addClient();
		setTimeout( this._finishPhase.bind( this ), this.phase.duration );

		messageStream.emit( new EventMessage( this, "Phase:Started" ) );
	}

	private async _finishPhase() {
		this.clientPool.shrink( this.clientPool.size() );

		await this.clientPool.close();

		this._removeListeners();

		messageStream.emit( new EventMessage( this, "Phase:Finished" ) );
	}

	private _addClient():void {
		if( this.clientPool.size() < this.phase.clients ) this.clientPool.grow();
		if( this._clientArrivalInterval && this.clientPool.size() >= this.phase.clients ) {
			clearInterval( this._clientArrivalInterval );
			this._clientArrivalInterval = null;
		}
	}

	private _registerListeners():void {
		this._listeners.push( messageStream.addListener(
			[
				Message.isFrom( [ this.clientPool ] ),
				EventMessage.is,
				EventMessage.isOneOf( ClientEvent.Ready )
			],
			this._onClientReady
		) );
	}

	private _removeListeners():void {
		this._listeners.forEach( messageStream.removeListener );
	}

	private _onClientReady:( message:Message ) => void = (function( this:PhaseOrchestrator, message:Message ):void {
		const scenario:Scenario = this._pickScenario();

		this.clientPool.executeAction( scenario.action );
	}).bind( this );

	private _createScenariosDistributionMap( scenarios:Scenario[] ):Map<Scenario, number> {
		const scenariosDistribution:Map<Scenario, number> = new Map();

		const total = scenarios
			.map( scenario => scenario.distribution )
			.reduce( ( previous, current ) => previous + current, 0 );

		scenarios.forEach( scenario => {
			const chance = (scenario.distribution * 100) / total;
			scenariosDistribution.set( scenario, chance );
		} );

		return scenariosDistribution;
	}

	private _pickScenario():Scenario {
		const roll:number = PhaseOrchestrator._getRandomNumber( 0, 100 );

		let sum:number = 0;
		let lastScenario:Scenario | null = null;
		for( let [ scenario, distribution ] of this._scenariosDistribution.entries() ) {
			sum = sum + distribution;
			if( roll <= sum ) return scenario;

			lastScenario = scenario;
		}

		if( lastScenario === null ) throw new Error();
		return lastScenario;

	}
}
