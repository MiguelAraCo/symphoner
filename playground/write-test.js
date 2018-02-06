const Carbon = require( "carbonldp/Carbon" ).Class;

module.exports = async function( statsd ) {
	const carbon = new Carbon( "localhost:8083", false );

	await carbon.documents.createChild( "/", {} );
};
