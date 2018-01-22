import { fork } from "child_process";
import { CommandMessage } from "./message";
import { ExecuteAction } from "./command";

export interface StatsDConfiguration {
	host:string;
	port:number;
}

export interface SymphonerConfiguration {
	statsd:StatsDConfiguration;
}

export interface Scenario {
	distribution:number;
	action:string;
}

export interface Phase {
	duration:number;
	clients:number;
	arrivalRate:number;
	scenarios:Scenario[];
}

export interface Test {
	phases:Phase[];
}

export class Symphoner {
	constructor( private configuration:SymphonerConfiguration ) {}

	run( test:Test ):void {
		// FIXME: Validate configuration
		// FIXME: Start phase
		// FIXME: Set timeout for phase end
		// FIXME: Start ClientPool


		test.phases.forEach( phase => {
			phase.scenarios.forEach( scenario => {
				const action = fork( __dirname + "/client" );
				action.on( "message", message => console.log( message ) );
				action.on( "disconnect", ( { ...args } ) => {
					console.log( "disconnect", args );
				} );
				action.on( "exit", () => {
					console.log( "exit" );
				} );

				setTimeout( () => {
					action.send( new CommandMessage( new ExecuteAction( scenario.action ) ) );
				}, 1000 );
			} )
		} );
	}
}
