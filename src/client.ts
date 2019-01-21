import {promisify} from "util";
import {stat as _stat, Stats} from "fs";
import {StatsD} from "node-statsd";

import {process} from "./forkedProcess";
import {ClientEvent, EventMessage, MessageSource} from "./message";
import {AbortCommand, Command, CommandMessage, ExecuteActionCommand, InitializeClientCommand} from "./command";
import {id} from "./id";
import {injectHTTPInspector} from "./httpInspector";
import {Timestamp, Timestamps} from "./time";
import {statsd} from "./stats/statsd";
import {Action} from "./actions";
import {State} from "./state";

const stat: (file: string) => Promise<Stats> = promisify(_stat);

class ActionTimestamps extends Timestamps {
	finished: Timestamp = [0, 0];
}

/**
 * Model intended to be used as the main class of a forked process that will act as a Client.
 * <p>
 * After creating the model it will start listening to messages through Node.js {@link process} when the parent process
 * sends {@link CommandMessage}s.
 */
class Client implements MessageSource {
	static readonly type: string = "Client";

	readonly id: string = id();
	readonly type: string = Client.type;

	private _state: State;

	/**
	 * Listen to messages coming from the parent process
	 */
	async listen() {
		process.on("message", this._handleMessage.bind(this));
	}

	private async _handleMessage(message: any) {
		if (!message || typeof message !== "object" || typeof message.type !== "string") return;

		switch (message.type) {
			case "Command":
				await this._handleCommandMessage(message);
				break;
			default:
				break;
		}
	}

	private async _handleCommandMessage(message: CommandMessage) {
		switch (message.command.name) {
			case "InitializeClient":
				await this._init(message.command as InitializeClientCommand);
				break;
			case "ExecuteAction":
				await this._start(message.command as ExecuteActionCommand);
				break;
			case "Abort":
				await this._abort(message.command as AbortCommand);
				break;
			default:
				break;
		}
	}

	private async _init(command: InitializeClientCommand) {
		statsd.instance = new StatsD(command.config.statsd);

		injectHTTPInspector(statsd.instance);

		this._reset();
	}

	private async _abort(command: AbortCommand) {
		if (this._state === State.IDLE) return;

		process.send(EventMessage.build(
			MessageSource.of(this),
			ClientEvent.ActionAborted,
		));

		setTimeout(() => process.exit(0), 0);
	}

	private async _start(command: ExecuteActionCommand) {
		if (this._state === State.RUNNING) {
			console.error("The client is already running an action");
			this._handleError();
			return;
		}
		this._state = State.RUNNING;

		process.send(EventMessage.build(
			MessageSource.of(this),
			ClientEvent.Working
		));

		let stats: Stats;
		try {
			stats = await stat(command.action);
		} catch (error) {
			console.error("ERROR: Couldn't open action's file:\n\t%o", error);
			this._handleError();
			return;
		}

		if (!stats.isFile()) {
			console.error("ERROR: The path registered for this action: '%s' isn't a file", command.action);
			this._handleError();
			return;
		}

		let action: Action;
		try {
			action = require(command.action) as Action;
		} catch (error) {
			console.error("ERROR: Couldn't require action's script '%s':\n\t%o", command.action, error);
			this._handleError();
			return;
		}

		if (typeof action !== "function") {
			console.error("ERROR: The action's script '%s' doesn't export a function", command.action);
			this._handleError();
			return;
		}

		const timestamps: ActionTimestamps = new ActionTimestamps();
		process.send(EventMessage.build(
			MessageSource.of(this),
			ClientEvent.ActionStarted,
		));

		let actionResult;
		try {
			actionResult = action({
				statsd: statsd.instance,
				settings: command.settings,
			});
		} catch (error) {
			await this._handleActionsError(command.action, error);
			return;
		}

		// Turn the result into a Promise if it is not already a Promise
		actionResult = !actionResult || !("then" in actionResult) ? Promise.resolve(actionResult) : actionResult;

		try {
			await actionResult;
		} catch (error) {
			await this._handleActionsError(command.action, error);
			return;
		} finally {
			timestamps.finished = process.hrtime();

			const finished: number = ActionTimestamps.ms(timestamps.finished, timestamps.created);
			statsd.instance.timing("action.duration", finished);
		}

		statsd.instance.increment("actions.success");
		process.send(EventMessage.build(
			MessageSource.of(this),
			ClientEvent.ActionFinished,
		));

		this._reset();
	}

	private _handleError() {
		process.send(EventMessage.build(
			MessageSource.of(this),
			ClientEvent.Error,
		));

		this._reset();
	}

	private _handleActionsError(action: string, error: any) {
		process.send(EventMessage.build(
			MessageSource.of(this),
			ClientEvent.ActionErrored,
		));

		statsd.instance.increment("actions.error");

		this._reset();
	}

	private _reset() {
		this._state = State.IDLE;

		process.send(EventMessage.build(
			MessageSource.of(this),
			ClientEvent.Ready,
		));
	}


}

(new Client()).listen().catch(error => console.error("ERROR! The client script has encountered an unexpected error:\n%e", error));
