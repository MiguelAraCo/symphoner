import { StatsD } from "node-statsd";

export let instance:StatsD | null;

export const statsd = {
	get instance():StatsD {
		if( instance === null ) throw new Error( "A StatsD instance hasn't been initialized" );
		return instance;
	},
	set instance( statsd:StatsD ) {
		instance = statsd;
	},
	close() {
		instance = null;
	},
};
