import { Test } from "./models";
import { PhaseOrchestrator } from "./phaseOrchestrator";

export interface StatsDConfiguration {
	host:string;
	port:number;
}

export interface SymphonerConfiguration {
	statsd:StatsDConfiguration;
}

export class Symphoner {
	constructor( private configuration:SymphonerConfiguration ) {}

	run( test:Test ):void {
		// FIXME: Validate configuration
		// FIXME: Start phase
		// FIXME: Set timeout for phase end
		// FIXME: Start ClientPool

		test.phases.forEach( phase => {
			const orchestrator:PhaseOrchestrator = new PhaseOrchestrator( phase );
			orchestrator.start();
		} );
	}
}
