import { StatsD } from "node-statsd";
import * as http from "http";
import { ClientRequest, IncomingMessage, RequestOptions } from "http";
import { URL } from "url";
import { process } from "./forkedProcess";
import { Timestamp, Timestamps } from "./time";

class RequestTimestamps extends Timestamps {
	socketAssigned:Timestamp = [ 0, 0 ];
	hostResolved:Timestamp = [ 0, 0 ];
	serverConnected:Timestamp = [ 0, 0 ];
	downloadStarted:Timestamp = [ 0, 0 ];
	downloadFinished:Timestamp = [ 0, 0 ];
	finished:Timestamp = [ 0, 0 ];
}

export function injectHTTPInspector( statsd:StatsD, prefix:string = "" ):void {
	prefix = prefix ? ! prefix.endsWith( "." ) ? prefix + "." : prefix : "";

	const originalRequest = http.request.bind( http );
	(<any> http)[ "request" ] = function( options:RequestOptions | string | URL, callback?:( response:IncomingMessage ) => void ):ClientRequest {
		const request = originalRequest( options, callback );

		const timestamps:RequestTimestamps = new RequestTimestamps();
		request.once( "socket", () => {
			timestamps.socketAssigned = process.hrtime();

			const queueing:number = RequestTimestamps.ms( timestamps.socketAssigned, timestamps.created );
			statsd.timing( prefix + "request.queueing", queueing );

			request.socket.once( "lookup", () => {
				timestamps.hostResolved = process.hrtime();
			} );
			request.socket.once( "connect", () => {
				timestamps.serverConnected = process.hrtime();

				const queueing:number = RequestTimestamps.ms( timestamps.serverConnected, timestamps.socketAssigned );
				statsd.timing( prefix + "request.connecting", queueing );
			} );

			// request.socket.once( "timeout", () => console.log( "Socket timeout" ) );
			// request.socket.once( "drain", () => console.log( "Socket drain" ) );
			// request.socket.once( "end", () => console.log( "Socket end" ) );
			// request.socket.once( "close", () => console.log( "Socket close" ) );

			request.socket.once( "error", ( error:Error ) => {
				timestamps.finished = process.hrtime();

				const total = RequestTimestamps.ms( timestamps.finished, timestamps.created );
				statsd.timing( prefix + "request.total", total );

				statsd.increment( prefix + "requests.error" );
			} );
		} );
		request.once( "response", ( response:IncomingMessage ):void => {
			timestamps.downloadStarted = process.hrtime();

			const waiting = RequestTimestamps.ms( timestamps.downloadStarted, timestamps.serverConnected );
			statsd.timing( prefix + "request.waiting", waiting );

			statsd.increment( prefix + "requests." + response.statusCode );

			response.once( "end", () => {
				statsd.increment( prefix + "request.bytes.read", request.socket.bytesRead );
				statsd.increment( prefix + "request.bytes.written", request.socket.bytesWritten );

				timestamps.downloadFinished = process.hrtime();

				const download = RequestTimestamps.ms( timestamps.downloadFinished, timestamps.downloadStarted );
				statsd.timing( prefix + "request.downloading", download );

				const total = RequestTimestamps.ms( timestamps.downloadFinished, timestamps.created );
				statsd.timing( prefix + "request.total", total );
			} );
		} );

		request.on( "abort", ():void => {
			timestamps.finished = process.hrtime();

			const total = RequestTimestamps.ms( timestamps.finished, timestamps.created );
			statsd.timing( prefix + "request.total", total );

			statsd.increment( prefix + "requests.abort" );
		} );
		request.on( "timeout", ():void => {
			timestamps.finished = process.hrtime();

			const total = RequestTimestamps.ms( timestamps.finished, timestamps.created );
			statsd.timing( prefix + "request.total", total );

			statsd.increment( prefix + "requests.timeout" );
		} );

		return request;
	};
}
