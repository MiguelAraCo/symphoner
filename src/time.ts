export class Time {
	constructor( readonly value:number ) {}

	get ms():number {
		return this.milliseconds;
	}

	get milliseconds():number {
		return this.value;
	}

	get s():number {
		return this.seconds;
	}

	get seconds():number {
		return this.value * 1000;
	}

	get min():number {
		return this.minutes;
	}

	get minutes():number {
		return this.seconds * 60;
	}

	get hrs():number {
		return this.hours;
	}

	get hours():number {
		return this.minutes * 60;
	}

	get days():number {
		return this.hours * 24;
	}

	get weeks():number {
		return this.days * 7;
	}
}

export function time( value:number ) {
	return new Time( value );
}

export type Timestamp = [ number, number ];

export abstract class Timestamps {
	static ms( [ s1, ns1 ]:Timestamp, [ s2, ns2 ]:Timestamp ):number {
		return (s1 - s2) * 1e3 + (ns1 - ns2) / 1e6;
	}

	static ns( [ s1, ns1 ]:Timestamp, [ s2, ns2 ]:Timestamp ):number {
		return (s1 - s2) * 1e9 + (ns1 - ns2);
	}

	created:[ number, number ] = [ 0, 0 ];

	constructor() {
		this.created = process.hrtime();
	}
}

export default time;
