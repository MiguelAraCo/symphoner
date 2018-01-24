import { ClientPool } from "./clientPool";
import { MessageEmitter, Phase, Scenario } from "./models";
import { ClientEvent, ClientEventMessage, CommandMessage, EventMessage } from "./message";
import { ExecuteActionCommand } from "./command";

export interface PhaseOrchestratorConfiguration {

}

export class PhaseOrchestrator extends MessageEmitter {
	private _scenariosDistribution:Map<Scenario, number>;
	private _clientArrivalInterval:number | null = null;

	constructor( readonly phase:Phase, readonly clientPool:ClientPool = new ClientPool(), configuration?:PhaseOrchestratorConfiguration ) {
		super();

		this._scenariosDistribution = this._createScenariosDistributionMap( phase.scenarios );
	}

	async start() {
		this._registerHandlers();
		this._startPhaseCycle();
	}

	private _startPhaseCycle():void {
		if( this.phase.clients > 1 ) this._clientArrivalInterval = setInterval( this._addClient.bind( this ), this.phase.arrivalRate );
		this._addClient();
		setTimeout( this._finishPhase.bind( this ), this.phase.duration );
	}

	private _finishPhase():void {
		// TODO
	}

	private _addClient():void {
		if( this.clientPool.size() < this.phase.clients ) this.clientPool.grow();
		if( this._clientArrivalInterval && this.clientPool.size() >= this.phase.clients ) {
			clearInterval( this._clientArrivalInterval );
			this._clientArrivalInterval = null;
		}
	}

	private _registerHandlers():void {
		this.clientPool.on( "message", this._handleMessage.bind( this ) );
	}

	protected _handleEventMessage( message:EventMessage ):void {
		switch( message.event ) {
			case ClientEvent.Ready:
				this._handleClientReadyEvent( message as ClientEventMessage );
				break;
		}

		super._handleEventMessage( message );
	}

	private _handleClientReadyEvent( message:ClientEventMessage ):void {
		const scenario:Scenario = this._pickScenario();

		message.client.send( new CommandMessage( new ExecuteActionCommand( scenario.action ) ) );
	}

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

	private static _getRandomNumber( min:number, max:number ):number {
		return Math.random() * (max - min + 1) + min;
	}
}
