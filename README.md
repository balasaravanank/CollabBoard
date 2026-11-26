# CollabBoard: Real-time Collaborative Notes + Whiteboard (Yjs + WebRTC)

How to use this doc: paste one phase at a time into Claude and say "I'm building this phase by phase. Give me the full code for Phase N and explain each block. I will type it myself." Build, test, then move to the next phase. Check docs.yjs.dev and github.com/yjs/y-webrtc if any install or API call errors (versions change).

---

## 1. What the app does

CollabBoard is a shared workspace opened by a link. Anyone with the link joins the same room and sees:

1. A shared notes editor. Everyone types at once, edits merge with no conflicts.
2. A shared whiteboard. Everyone draws pens and rectangles live.
3. Presence. Live cursors with names and colors, plus a "who's online" list.
4. Offline support. Edit with no internet, reconnect, everything merges.
5. Per-user undo (your undo only undoes YOUR changes).

No central database holds the document. The data lives in each browser and syncs peer to peer.

## 2. The key idea: CRDT

A CRDT (Conflict-free Replicated Data Type) is a data structure where every user can edit their own copy at any time, and when copies exchange updates, they always converge to the same result, in any order, with no central referee.

Yjs is a CRDT library. You use shared types that look like normal JS types:
- Y.Text (text), Y.Map (object), Y.Array (list), Y.XmlFragment (rich text trees, used by Tiptap).
- Y.Doc is the container for all of them.
- Every change becomes a small binary "update". Updates can be applied in any order and any number of times.

## 3. Architecture

```
 Browser A                      Browser B
 +-------------+                +-------------+
 | React UI    |                | React UI    |
 | Y.Doc       | <== WebRTC ==> | Y.Doc       |
 | IndexedDB   |   (data goes   | IndexedDB   |
 +-------------+    directly)   +-------------+
        \                          /
         \--- Signaling server ---/   (only helps peers find each other)
         TURN server (relay fallback for strict networks)
```

Honest truth for interviews: "no server" means no server holds or processes the document. Peers still need:
- A signaling server (tiny WebSocket relay) to exchange connection info.
- A TURN server for users behind strict NATs where direct connection fails.

## 4. Tech stack

- Vite + React + TypeScript
- yjs (CRDT), y-webrtc (peer sync), y-indexeddb (offline persistence)
- Tiptap v2 (rich text editor) with its Collaboration extensions
- Plain HTML canvas for the whiteboard
- Node (signaling server), Railway/Render (host it), Vercel (host the frontend)

## 5. Folder structure (final)

```
collabboard/
  server/signaling.js
  src/
    lib/room.ts          # Y.Doc + providers
    components/Notes.tsx
    components/Whiteboard.tsx
    components/Presence.tsx
    App.tsx
    main.tsx
```

---

## Phase 0: Setup (15 min)

```bash
npm create vite@latest collabboard -- --template react-ts
cd collabboard
npm install
npm install yjs y-webrtc y-indexeddb
npm install @tiptap/react@^2 @tiptap/starter-kit@^2 @tiptap/extension-collaboration@^2 @tiptap/extension-collaboration-cursor@^2
npm run dev
```

Why Tiptap v2: the v3 API changed some option names. v2 matches the code below.

Done when: the default Vite page opens at localhost:5173.

---

## Phase 1: Shared notes (the "wow" phase)

### src/lib/room.ts

```ts
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'

// Room id comes from the URL hash: http://localhost:5173/#abc123
export function getRoomId(): string {
  let id = window.location.hash.slice(1)
  if (!id) {
    id = Math.random().toString(36).slice(2, 8)
    window.location.hash = id
  }
  return id
}

const roomId = getRoomId()

// The Y.Doc holds ALL shared data for this room.
export const ydoc = new Y.Doc()

// WebrtcProvider syncs the doc with other peers in the same room name.
export const provider = new WebrtcProvider('collabboard-' + roomId, ydoc)

// Saves the doc in the browser so it survives refresh and works offline.
export const persistence = new IndexeddbPersistence('collabboard-' + roomId, ydoc)

export { roomId }
```

Explanation:
- `getRoomId` makes the link the invite. Share the URL with the hash, friend joins the same room.
- `Y.Doc` is the single source of truth, everything else is a view on it.
- `WebrtcProvider(roomName, ydoc)` connects to peers who use the same room name. It uses a signaling server only to find them.
- `IndexeddbPersistence` stores updates locally, so reload keeps your data.

### src/components/Notes.tsx

```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { ydoc } from '../lib/room'

export default function Notes() {
  const editor = useEditor({
    extensions: [
      // history must be off, Yjs has its own undo
      StarterKit.configure({ history: false }),
      // binds the editor to a Y.XmlFragment named "notes" inside the doc
      Collaboration.configure({ document: ydoc, field: 'notes' }),
    ],
  })

  return (
    <div style={{ border: '1px solid #ccc', padding: 12, minHeight: 300 }}>
      <EditorContent editor={editor} />
    </div>
  )
}
```

Explanation:
- Tiptap normally keeps its own state. The Collaboration extension swaps that for a Yjs shared type, so every keystroke becomes a Yjs update.
- `field: 'notes'` is the name of the shared type. Notes and whiteboard live in different fields of the same doc.

### src/App.tsx

```tsx
import Notes from './components/Notes'
import { roomId } from './lib/room'

export default function App() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h2>CollabBoard</h2>
      <p>Room: {roomId} (share this URL)</p>
      <Notes />
    </div>
  )
}
```

Test: open the URL in two tabs (same hash). Type in one, see it in the other. Then open it in an incognito window too.

Done when: two tabs sync live and a refresh keeps the text.

---

## Phase 2: Presence (names, colors, live cursors)

Update `Notes.tsx`:

```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { ydoc, provider } from '../lib/room'

const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#008080']
const color = COLORS[Math.floor(Math.random() * COLORS.length)]
const name = localStorage.getItem('name') || 'User' + Math.floor(Math.random() * 100)
localStorage.setItem('name', name)

export default function Notes() {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc, field: 'notes' }),
      CollaborationCursor.configure({ provider, user: { name, color } }),
    ],
  })

  return (
    <div style={{ border: '1px solid #ccc', padding: 12, minHeight: 300 }}>
      <EditorContent editor={editor} />
    </div>
  )
}
```

Add cursor styling in `src/index.css` (append):

```css
.collaboration-cursor__caret {
  border-left: 1px solid #0d0d0d;
  border-right: 1px solid #0d0d0d;
  margin-left: -1px;
  margin-right: -1px;
  position: relative;
  word-break: normal;
  pointer-events: none;
}
.collaboration-cursor__label {
  position: absolute;
  top: -1.4em;
  left: -1px;
  font-size: 12px;
  color: #fff;
  padding: 0 4px;
  border-radius: 3px 3px 3px 0;
  white-space: nowrap;
}
```

### src/components/Presence.tsx

```tsx
import { useEffect, useState } from 'react'
import { provider } from '../lib/room'

type User = { name: string; color: string }

export default function Presence() {
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    const awareness = provider.awareness
    const update = () => {
      const list: User[] = []
      awareness.getStates().forEach((state) => {
        if (state.user) list.push(state.user as User)
      })
      setUsers(list)
    }
    awareness.on('change', update)
    update()
    return () => awareness.off('change', update)
  }, [])

  return (
    <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
      {users.map((u, i) => (
        <span key={i} style={{ background: u.color, color: '#fff', padding: '2px 8px', borderRadius: 12 }}>
          {u.name}
        </span>
      ))}
    </div>
  )
}
```

Add `<Presence />` above `<Notes />` in App.tsx (import it first).

Explanation:
- Awareness is NOT part of the document. It is temporary state (cursor, name) that disappears when a user leaves. It is not saved.
- `awareness.getStates()` returns a Map of clientID to state. The cursor extension writes `user` into it for you.

Done when: two tabs show each other's colored cursor with a name label, and the online list shows both.

---

## Phase 3: Whiteboard

Data model: a `Y.Map` called "shapes". Key = shape id, value = a plain object. Each finished shape is written once and never mutated, which keeps things simple and conflict-free.

```ts
type Shape =
  | { id: string; type: 'pen'; color: string; points: number[][] }   // [[x,y],...]
  | { id: string; type: 'rect'; color: string; x: number; y: number; w: number; h: number }
```

### src/components/Whiteboard.tsx

```tsx
import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { ydoc } from '../lib/room'

type Shape =
  | { id: string; type: 'pen'; color: string; points: number[][] }
  | { id: string; type: 'rect'; color: string; x: number; y: number; w: number; h: number }

const shapes = ydoc.getMap<Shape>('shapes')

function draw(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.strokeStyle = s.color
  ctx.lineWidth = 2
  if (s.type === 'pen') {
    ctx.beginPath()
    s.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
    ctx.stroke()
  } else {
    ctx.strokeRect(s.x, s.y, s.w, s.h)
  }
}

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<'pen' | 'rect'>('pen')
  const [color, setColor] = useState('#000000')
  const current = useRef<Shape | null>(null)   // shape being drawn right now (local only)
  const start = useRef<[number, number]>([0, 0])

  // Redraw everything: committed shapes + the in-progress one
  const render = () => {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    shapes.forEach((s) => draw(ctx, s))
    if (current.current) draw(ctx, current.current)
  }

  // Redraw whenever ANY peer (or you) changes the shapes map
  useEffect(() => {
    shapes.observe(render)
    render()
    return () => shapes.unobserve(render)
  }, [])

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  const down = (e: React.PointerEvent) => {
    const [x, y] = pos(e)
    start.current = [x, y]
    const id = crypto.randomUUID()
    current.current =
      tool === 'pen'
        ? { id, type: 'pen', color, points: [[x, y]] }
        : { id, type: 'rect', color, x, y, w: 0, h: 0 }
  }

  const move = (e: React.PointerEvent) => {
    if (!current.current) return
    const [x, y] = pos(e)
    const s = current.current
    if (s.type === 'pen') s.points.push([x, y])
    else {
      s.x = Math.min(start.current[0], x)
      s.y = Math.min(start.current[1], y)
      s.w = Math.abs(x - start.current[0])
      s.h = Math.abs(y - start.current[1])
    }
    render()
  }

  const up = () => {
    if (!current.current) return
    shapes.set(current.current.id, current.current) // commit: this syncs to peers
    current.current = null
  }

  return (
    <div>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
        <button onClick={() => setTool('pen')} disabled={tool === 'pen'}>Pen</button>
        <button onClick={() => setTool('rect')} disabled={tool === 'rect'}>Rect</button>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button onClick={() => ydoc.transact(() => shapes.clear())}>Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        width={880}
        height={400}
        style={{ border: '1px solid #ccc', touchAction: 'none' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
      />
    </div>
  )
}
```

Explanation:
- `ydoc.getMap('shapes')` is a shared Y.Map. Two users adding different keys never conflict.
- Unique ids (`crypto.randomUUID`) are the trick that avoids collisions.
- `shapes.observe(render)` fires on local AND remote changes. That one line is what makes it live.
- While drawing we keep the shape local and only commit on pointer up. This avoids sending hundreds of updates per stroke. (Upgrade later: live preview of other people's strokes via awareness.)
- `transact` batches many changes into one update.

Add `<Whiteboard />` below `<Notes />` in App.tsx.

Done when: draw in one tab, it appears in the other, and Clear works for everyone.

---

## Phase 4: The distributed-systems part

### 4a. Your own signaling server

```bash
mkdir server && cd server
npm init -y
npm install y-webrtc
```

`server/signaling.js`:

```js
// y-webrtc ships a ready-made signaling server. Just start it.
require('y-webrtc/bin/server.js')
```

Run locally: `PORT=4444 node signaling.js` (Windows PowerShell: `$env:PORT=4444; node signaling.js`).

If the require fails with your y-webrtc version, run directly instead: `PORT=4444 node node_modules/y-webrtc/bin/server.js`.

Point the client at it in `room.ts`:

```ts
const SIGNALING = import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:4444'

export const provider = new WebrtcProvider('collabboard-' + roomId, ydoc, {
  signaling: [SIGNALING],
  peerOpts: {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // TURN (from a free provider like Metered Open Relay): fill in from their dashboard
        // { urls: 'turn:YOUR_TURN_HOST:443', username: 'USER', credential: 'PASS' },
      ],
    },
  },
})
```

Explanation:
- Signaling: peers exchange "here is how to reach me" messages through it. It never sees your document content.
- STUN tells a peer its public address. TURN relays traffic when a direct path is impossible. Without TURN, some users on strict networks (college wifi, mobile carriers) cannot connect. That is the bug you will hit, and a great LinkedIn post.

Deploy: push `server/` to GitHub, create a Railway or Render web service, start command `node node_modules/y-webrtc/bin/server.js`. Use the `wss://` URL as `VITE_SIGNALING_URL`.

### 4b. Prove CRDT merging (test checklist)

1. Open the room on two devices on different networks (laptop wifi, phone on mobile data).
2. Turn off wifi on device A. Type a paragraph. Turn off data on B, type something in the same area.
3. Turn both back on. Both edits appear on both devices, no loss, no conflict.
4. Screen-record this. It is your demo GIF.

### 4c. Per-user undo

In `Notes.tsx`, Tiptap's Collaboration extension already uses Y.UndoManager for undo/redo. Ctrl+Z undoes only your own edits. For the whiteboard add:

```ts
import * as Y from 'yjs'
export const undoManager = new Y.UndoManager(shapes)
```

Call `undoManager.undo()` from an Undo button. By default it tracks only changes made by this client, which is exactly per-user undo.

Done when: works across two networks, offline edits merge, your signaling server is deployed.

---

## Phase 5: Ship

1. Frontend on Vercel: push to GitHub, import the repo, set `VITE_SIGNALING_URL` to your wss URL.
2. README must have: a GIF of two live cursors, an architecture diagram (draw in Excalidraw, use the diagram in section 3), a "How CRDTs work" section in your own words, the honest note about signaling and TURN, and a "What I would improve" list.
3. Add a "Known limits" section: no auth, rooms are public by link, whiteboard shapes cannot be edited after commit.

## Stretch goals (after it works)

- Live in-progress strokes of other users through awareness.
- Move/resize shapes (store shapes as nested Y.Maps).
- Room password using y-webrtc's `password` option.
- Export notes to Markdown, board to PNG.
- Replace the whiteboard with a Y.Array for z-order.

## LinkedIn series (build in public)

1. Kickoff + architecture sketch.
2. GIF of two tabs syncing.
3. "What broke": the TURN/NAT problem and how you fixed it.
4. Deployed demo + what you learned about CRDTs.

## Interview talking points

- Why CRDT over operational transform: no central server needed for ordering, works offline.
- What "no server" really means (signaling + TURN).
- Why awareness is separate from the doc (ephemeral vs persistent state).
- Why shape ids are UUIDs (avoid key collisions between peers).
- Why y-indexeddb: offline-first and fast reloads.

## Debug cheat sheet

- Tabs do not sync: check both use the same room hash; check the browser console for signaling WebSocket errors; the public default signaling servers are unreliable, use your own.
- Works on same wifi, fails across networks: you need TURN.
- Two cursors show the same name: the name is per-browser in localStorage, so each browser profile gets its own.
- Tiptap "history" errors: you must disable StarterKit history when using Collaboration.
- Duplicate shapes on refresh: you are mixing persistence with a stale doc; clear site data in DevTools > Application > IndexedDB.
