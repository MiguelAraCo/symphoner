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
			arrivalRate: time( 2 ).seconds,
			clients: 5,
			scenarios: [
				// {
				// 	action: __dirname + "/read-test.js",
				// 	distribution: 80
				// },
				{
					action: __dirname + "/write-test.js",
					distribution: 20
				}
			]
		}
	]
} );
