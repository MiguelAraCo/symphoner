import { Test } from "./models";
import { PhaseOrchestrator } from "./phaseOrchestrator";
import { messageStream } from "./messageStream";
import { EventMessage } from "./message";

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

		messageStream.addListener( () => true, message => {
			if( ! ("getHours" in message.timestamp) ) console.log( message );

			let logMessage = `${message.timestamp.getHours()}:${message.timestamp.getMinutes()}:${message.timestamp.getSeconds()}:${message.timestamp.getMilliseconds()} - ${message.source.type}#${message.source.id}: ${message.type}`;
			if( EventMessage.is( message ) ) logMessage += `{${(message as EventMessage).event}}`;

			console.log( logMessage );
		} );

		test.phases.forEach( phase => {
			const orchestrator:PhaseOrchestrator = new PhaseOrchestrator( phase );
			orchestrator.start();
		} );
	}
}
