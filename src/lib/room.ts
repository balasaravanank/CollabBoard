import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'

export function getRoomId(): string {
  let id = window.location.hash.slice(1)
  if (!id) {
    id = Math.random().toString(36).slice(2, 8)
    window.location.hash = id
  }
  return id
}

const roomId = getRoomId()

// This module runs once at load, so changing the hash later would not switch rooms.
window.addEventListener('hashchange', () => window.location.reload())

const SIGNALING = import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:4444'

export const ydoc = new Y.Doc()

export const provider = new WebrtcProvider('collabboard-' + roomId, ydoc, {
  signaling: [SIGNALING],
})

export const persistence = new IndexeddbPersistence('collabboard-' + roomId, ydoc)

export { roomId }