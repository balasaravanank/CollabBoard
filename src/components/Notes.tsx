import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { ydoc } from '../lib/room'

export default function Notes() {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc, field: 'notes' }),
    ],
  })

  return (
    <div style={{ border: '1px solid #ccc', padding: 12, minHeight: 300 }}>
      <EditorContent editor={editor} />
    </div>
  )
}