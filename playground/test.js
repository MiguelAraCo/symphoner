const { resolve } = require( "path" );

const { Symphoner } = require( "./../dist" );
const { time } = require( "./../dist/time" );

const symphoner = new Symphoner( {
	statsd: {
		host: "localhost",
		port: 8088
	}
} );

symphoner.run( {
	phases: [
		{
			duration: time( 2 ).minutes,
			arrivalRate: time( 10 ).seconds,
			clients: 5,
			scenarios: [
				// {
				// 	action: resolve( "playground/read-test.js" ),
				// 	distribution: 80
				// },
				{
					action: resolve( "playground/read-test.js" ),
					distribution: 20
				}
			]
		}
	]
} );
