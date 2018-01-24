module.exports = async function() {
	console.log( "Doing something!" );

	await new Promise( ( resolve, reject ) => setTimeout( resolve, 5000 ) );

	console.log( "Finished action" );
};
