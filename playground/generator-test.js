module.exports = function* ( signal ) {
	console.log( "Executing action" );
	yield new Promise( ( resolve, reject ) => setTimeout( resolve, 2000 ) );
	console.log( "This should never be logged" );
};
