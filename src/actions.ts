import { StatsD } from "node-statsd";

export interface ActionConfiguration {
	statsd:StatsD;
	settings:{ [name:string]:any };
}

export interface Action {
	( configuration:ActionConfiguration ):void | Promise<any>;
}

export interface SynchronousAction extends Action {
	( configuration:ActionConfiguration ):void;
}

export interface AsynchronousAction extends Action {
	( configuration:ActionConfiguration ):Promise<any>;
}
