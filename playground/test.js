const { Symphoner } = require( "./../dist" );
const { time } = require( "./../dist/time" );

const symphoner = new Symphoner( {
	statsd: {
		host: "localhost",
		port: 8125
	}
} );

symphoner
	.run( {
		phases: [
			{
				duration: time( 10 ).seconds,
				arrivalRate: time( 20 ).seconds,
				clients: 6,
				scenarios: [
					{
						action: __dirname + "/read-test.js",
						distribution: 80
					},
					{
						action: __dirname + "/write-test.js",
						distribution: 20
					},
					{
						action: __dirname + "/404-test.js",
						distribution: 10
					},
					{
						action: __dirname + "/500-test.js",
						distribution: 10
					}
				]
			}
		]
	} )
	.then( () => process.exit( 0 ) )
	.catch( error => {
		console.error( error );
		process.exit( 1 );
	} );
