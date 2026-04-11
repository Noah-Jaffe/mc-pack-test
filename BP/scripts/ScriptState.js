/** ScriptState holds a persistent passable object for the command */
export /*interface*/ class ScriptState {
	/** @propety {number|null} [id] - id of active job */
	id;//?: number | null;
	/** @propety {boolean} [debug] - optional debug flag */
	debug;//?: boolean;
  // custom fields as needed
  // [key: string]: unknown;
  
  constructor(kwArgs) {
  	if (typeof kwArgs === "object") {
  		for (const [k, v] of kwArgs) {
  			this[k] = v;
  		}
  	} else {
  		this["_args"] = kwArgs;
  	}
  }
}
