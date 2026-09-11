import { useCallback, useReducer } from 'react';

function reducer(state, action) {
  if (action.type === 'undo' && state.past.length) return { past: state.past.slice(0, -1), present: state.past.at(-1), future: [state.present, ...state.future] };
  if (action.type === 'redo' && state.future.length) return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
  if (action.type === 'reset') return { past: [], present: action.value, future: [] };
  if (action.type !== 'set') return state;
  const present = typeof action.value === 'function' ? action.value(state.present) : action.value;
  if (present === state.present) return state;
  return { past: [...state.past.slice(-49), state.present], present, future: [] };
}

export default function useHistoryState(initial) {
  const [state, dispatch] = useReducer(reducer, initial, value => ({ past: [], present: typeof value === 'function' ? value() : value, future: [] }));
  const set = useCallback(value => dispatch({ type: 'set', value }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const reset = useCallback(value => dispatch({ type: 'reset', value }), []);
  return [state.present, set, { undo, redo, reset, canUndo: !!state.past.length, canRedo: !!state.future.length }];
}
