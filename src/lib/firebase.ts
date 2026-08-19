/**
 * Firebase wiring.
 *
 * There is NO AUTHENTICATION here, deliberately — no sign-in, no anonymous auth, no
 * gate of any kind. The app opens straight into the planner. Access control lives
 * entirely in firestore.rules, which opens exactly one document and denies the rest
 * of the database. See README, "Why there is no login".
 *
 * The SDK is imported dynamically so the first paint never waits on it: the board
 * renders from localStorage, and the realtime subscription attaches a moment later.
 * If the VITE_FIREBASE_* variables are absent this module reports itself
 * unconfigured and the app runs from localStorage alone.
 */
import type { DocumentReference } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** The single fixed document that holds the entire plan, e.g. "plans/goo". */
export const PLAN_DOC_PATH: string = import.meta.env.VITE_PLAN_DOC_PATH || 'plans/goo'

export const isConfigured = Boolean(config.apiKey && config.projectId)

export type Firestore = typeof import('firebase/firestore')

export interface PlanDoc {
  fs: Firestore
  ref: DocumentReference
}

let connection: Promise<PlanDoc | null> | null = null

/** Resolves once (and only once) to the shared plan document, or null if unconfigured. */
export function connect(): Promise<PlanDoc | null> {
  if (!isConfigured) return Promise.resolve(null)
  if (!connection) {
    connection = (async () => {
      const [{ initializeApp }, fs] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore'),
      ])
      const app = initializeApp(config)
      const db = fs.getFirestore(app)
      const [collection, id, ...rest] = PLAN_DOC_PATH.split('/')
      return { fs, ref: fs.doc(db, collection, id, ...rest) }
    })().catch(() => null)
  }
  return connection
}
