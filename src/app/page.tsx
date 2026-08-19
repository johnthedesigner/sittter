import { redirect } from 'next/navigation'

/** V1 has no marketing page. The root sends an admin to their home screen. */
export default function Page() {
  redirect('/home')
}
