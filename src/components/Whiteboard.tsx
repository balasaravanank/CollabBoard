import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
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
  const current = useRef<Shape | null>(null) // in-progress shape, local only
  const start = useRef<[number, number]>([0, 0])

  const render = () => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    shapes.forEach((s) => draw(ctx, s))
    if (current.current) draw(ctx, current.current)
  }

  useEffect(() => {
    shapes.observe(render)
    render()
    return () => shapes.unobserve(render)
  }, [])

  const pos = (e: RPointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  const down = (e: RPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const [x, y] = pos(e)
    start.current = [x, y]
    const id = crypto.randomUUID()
    current.current =
      tool === 'pen'
        ? { id, type: 'pen', color, points: [[x, y]] }
        : { id, type: 'rect', color, x, y, w: 0, h: 0 }
  }

  const move = (e: RPointerEvent<HTMLCanvasElement>) => {
    const s = current.current
    if (!s) return
    const [x, y] = pos(e)
    if (s.type === 'pen') {
      s.points.push([x, y])
    } else {
      s.x = Math.min(start.current[0], x)
      s.y = Math.min(start.current[1], y)
      s.w = Math.abs(x - start.current[0])
      s.h = Math.abs(y - start.current[1])
    }
    render()
  }

  const up = () => {
    const s = current.current
    if (!s) return
    current.current = null
    const empty = s.type === 'pen' ? s.points.length < 2 : s.w < 2 || s.h < 2
    if (!empty) shapes.set(s.id, s) // commit: this is what syncs to peers
    render()
  }

  return (
    <div>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
        <button onClick={() => setTool('pen')} disabled={tool === 'pen'}>Pen</button>
        <button onClick={() => setTool('rect')} disabled={tool === 'rect'}>Rect</button>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button onClick={() => shapes.clear()}>Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        width={880}
        height={400}
        style={{ border: '1px solid #ccc', touchAction: 'none' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
    </div>
  )
}