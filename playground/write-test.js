module.exports = async function() {
	console.log( "Doing something!" );

	await new Promise( ( resolve, reject ) => setTimeout( resolve, 1000 ) );

	console.log( "Finished doing something" );
};
