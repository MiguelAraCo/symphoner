import Process = NodeJS.Process;

interface ForkedProcess {
	send( message:any, sendHandle?:any ):void;
}

if( typeof process.send === "undefined" ) {
	console.error( "ERROR: The client script was called individually instead of being a part of a cluster" );
	process.exit( 1 );
}

let _process:Process & ForkedProcess = <any>process;

export {
	ForkedProcess,
	_process as process
};
