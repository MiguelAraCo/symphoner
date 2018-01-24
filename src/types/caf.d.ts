declare interface CAFTokenSignal {

}

declare interface CAFToken {
	abort:( message?:string ) => void;
	pr:Promise<any>;
	signal:CAFTokenSignal;

	new ():CAFToken;
}

declare module "caf" {
	interface CAGF extends GeneratorFunction {
		( signal:CAFTokenSignal, ...args:any[] ):Generator;
	}

	interface CAF {
		<T>( generator:CAGF ):( signal:CAFTokenSignal, ...args:any[] ) => Promise<T>;

		cancelToken:CAFToken;
	}

	const instance:CAF;
	export = instance;
}
