import { redirect } from 'next/navigation'
import { getIsAdmin } from '@/lib/adminAuth'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const isAdmin = await getIsAdmin()
  if (!isAdmin) {
    redirect('/hoje')
  }
  return <AdminClient />
}
