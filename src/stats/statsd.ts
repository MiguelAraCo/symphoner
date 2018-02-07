import { StatsD } from "node-statsd";

export let statsd:{ instance:StatsD, [x:string]:any } = {
	_instance: null,
	get instance():StatsD {
		return this._instance;
	},
	set instance( statsd:StatsD ) {
		this._instance = statsd;
	}
};
