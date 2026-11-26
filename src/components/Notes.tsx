import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { ydoc, provider } from '../lib/room'

const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#008080']
const color = COLORS[Math.floor(Math.random() * COLORS.length)]
const name = sessionStorage.getItem('name') || 'User' + Math.floor(Math.random() * 100)
sessionStorage.setItem('name', name)

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