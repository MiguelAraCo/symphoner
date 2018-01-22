export interface Command {
	readonly name:string;
}

export class ExecuteAction implements Command {
	readonly name:string = "ExecuteAction";

	constructor( readonly action:string ) {}
}
