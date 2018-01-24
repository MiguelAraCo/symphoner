export interface Command {
	readonly name:string;
}

export class ExecuteActionCommand implements Command {
	readonly name:string = "ExecuteAction";

	constructor( readonly action:string ) {}
}

export class AbortCommand implements Command {
	readonly name:string = "Abort";
}
