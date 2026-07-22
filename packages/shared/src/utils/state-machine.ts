/**
 * A tiny, immutable finite-state-machine helper for status fields.
 *
 * Given a map of `status -> allowed next statuses`, it answers the questions the
 * domain repeatedly needs: is a transition legal, is a status terminal, and what
 * are the legal next states. Terminal states map to an empty list.
 */
export interface StatusMachine<S extends string> {
  /** The underlying transition table. */
  readonly transitions: Readonly<Record<S, readonly S[]>>;
  /** Returns true if moving from `from` to `to` is a legal transition. */
  canTransition(from: S, to: S): boolean;
  /** Returns true if `status` has no legal outgoing transitions. */
  isTerminal(status: S): boolean;
  /** Returns the legal next statuses from `status`. */
  nextStates(status: S): readonly S[];
}

export function createStatusMachine<S extends string>(
  transitions: Record<S, readonly S[]>,
): StatusMachine<S> {
  return {
    transitions,
    canTransition: (from, to) => transitions[from].includes(to),
    isTerminal: (status) => transitions[status].length === 0,
    nextStates: (status) => transitions[status],
  };
}
