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