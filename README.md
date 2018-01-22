# Symphoner

Load/performance testing framework

## Install

```bash
npm install symphoner
```

## Usage

Read the framework's [documentation](./docs/).

### Examples

#### Testing a REST API

```javascript
const Symphoner = require( "symphoner" );
const time = require( "symphoner/time" );

const symphoner = new Symphoner( {
	statsd: {
	    host: "localhost",
	    port: 8125
	}
} );

symphoner.run( {
    phases: [
        {
            duration: time( 20 ).minutes,
            clients: 20,
            arrivalRate: time( 10 ).seconds
            scenarios: [
                {
                    distribution: 80, // %
                    action: "read-test.js"
                },
                {
                    distribution: 20, // %,
                    action: "write-test.js"
                }
            ]
        }
    ]
} );
```

## License

MIT © Miguel Aragón, Rodolfo Aguirre
