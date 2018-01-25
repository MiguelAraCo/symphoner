export interface Scenario {
	distribution:number;
	action:string;
}

export interface Phase {
	duration:number;
	clients:number;
	arrivalRate:number;
	scenarios:Scenario[];
}

export interface Test {
	phases:Phase[];
}
