import { uuidv7 } from 'uuidv7'

/** Time-ordered id used for every row created on a client or the server. */
export function newId(): string {
  return uuidv7()
}
