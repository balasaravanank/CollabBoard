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