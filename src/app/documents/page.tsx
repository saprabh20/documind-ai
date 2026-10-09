import DocumentsPage from '@/components/DocumentsPage'

export default function Page() {
  const uploadEnabled = process.env.ENABLE_UPLOAD === 'true'
  const deleteEnabled = process.env.ENABLE_DELETE === 'true'
  return <DocumentsPage uploadEnabled={uploadEnabled} deleteEnabled={deleteEnabled} />
}
