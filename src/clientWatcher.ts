import {ChildProcess, fork} from "child_process";
import time from "./time";
import {ClientEvent, ClientEventMessage, EventMessage, Message, MessageSource} from "./message";
import {AbortCommand, CommandMessage, InitializeClientCommand} from "./command";
import {id} from "./id";
import {messageStream} from "./messageStream";
import {statsd} from "./stats/statsd";

export interface ClientWatcherConfiguration {
	timeout: number;
	abortTimeout: number;
	clientScript: string;
}

const defaultConfiguration: ClientWatcherConfiguration = {
	timeout: time(1).minutes,
	abortTimeout: time(5).seconds,
	clientScript: __dirname + "/client",
};

export class ClientWatcher implements MessageSource {
	static readonly type: string = "ClientWatcher";

	readonly id: string = id();
	readonly type: string = ClientWatcher.type;

	private readonly _configuration: ClientWatcherConfiguration;

	private _client: ChildProcess;
	private _timeoutID: number | null = null;
	private _abortTimeoutID: number | null = null;

	constructor(configuration?: Partial<ClientWatcherConfiguration>) {
		this._onMessage = this._onMessage.bind(this);
		this._onClientDisconnect = this._onClientDisconnect.bind(this);
		this._onClientExit = this._onClientExit.bind(this);

		this._configuration = {
			...defaultConfiguration,
			...configuration
		};

		this._startClient();
		this._registerListeners();
		this._registerTimeout();
		this._initializeClient();
	}

	send(message: Message): void {
		this._client.send(message);
	}

	async abort(): Promise<void> {
		// TODO: Solve the problem with the kill signal (the _reset method is removing the timeout)

		// Create a promise and capture its resolve/reject fns to control it asynchronously
		let resolve: () => void;
		let reject: (error: any) => void;
		const promise = new Promise<void>((_resolve, _reject) => {
			resolve = _resolve;
			reject = _reject;
		});

		// Remove all listeners except for "message" events
		this._clearListeners();
		this._client.addListener("message", this._onMessage);

		const onClientShutdown = () => {
			this._client.removeListener("disconnect", onClientShutdown);
			this._client.removeListener("exit", onClientShutdown);

			this._close();

			resolve();
		};

		this._client.addListener("disconnect", onClientShutdown);
		this._client.addListener("exit", onClientShutdown);

		this._abortTimeoutID = setTimeout(() => {
			this._client.removeListener("disconnect", onClientShutdown);
			this._client.removeListener("exit", onClientShutdown);

			this._client.kill("SIGKILL");
			this._close();

			resolve();
		}, this._configuration.abortTimeout) as any;

		this._client.send(CommandMessage.build(
			MessageSource.of(this),
			AbortCommand.build()
		));

		return promise;
	}

	private _startClient() {
		this._client = fork(this._configuration.clientScript);
	}

	private _initializeClient() {
		this._client.send(CommandMessage.build(
			MessageSource.of(this),
			InitializeClientCommand.build({
				statsd: {
					host: statsd.instance.host,
					port: statsd.instance.port,
					prefix: statsd.instance.prefix,
					suffix: statsd.instance.suffix,
					global_tags: statsd.instance.global_tags,
				},
			})
		));
	}

	private _registerListeners() {
		this._client.on("message", this._onMessage);
		this._client.on("disconnect", this._onClientDisconnect);
		this._client.on("exit", this._onClientExit);
	}

	private _clearListeners() {
		this._client.removeListener("message", this._onMessage);
		this._client.removeListener("disconnect", this._onClientDisconnect);
		this._client.removeListener("exit", this._onClientExit);
	}

	private _onMessage(message: any) {
		if (!message) return;
		if (typeof message !== "object") return;
		if (!("type" in message)) return;

		switch (message.type) {
			case "Event":
				this._onEventMessage(message as EventMessage);
				break;
			default:
				// TODO: Should it be broadcasted?
				break;
		}
	}

	private _onEventMessage(message: EventMessage) {
		switch (message.event) {
			// TODO: Add action error events
			case ClientEvent.ActionFinished:
				this._reset();
				break;
			default:
				break;
		}

		const messageToBroadcast = ClientEventMessage.build(this, {
			...message,
			// Deserialize the received message timestamp
			timestamp: new Date(message.timestamp),
		});

		messageStream.emit(messageToBroadcast);
	}

	private _onClientDisconnect() {
		messageStream.emit(EventMessage.build(this, ClientEvent.Disconnected));
		this._close();
	}

	private _onClientExit() {
		messageStream.emit(EventMessage.build(this, ClientEvent.Exited));
		this._close();
	}

	private _registerTimeout() {
		this._timeoutID = setTimeout(this.abort.bind(this), this._configuration.timeout);
	}

	private _reset() {
		this._clearTimeouts();
	}

	private _close() {
		this._clearTimeouts();
		this._clearListeners();
	}

	private _clearTimeouts() {
		if (this._timeoutID !== null) clearTimeout(this._timeoutID);
		if (this._abortTimeoutID !== null) clearTimeout(this._abortTimeoutID);
	}
}
