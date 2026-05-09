import { useState, useEffect } from 'react'
import ContactList from '../components/ContactList'
import { getContacts } from '../lib/api'

export default function Contacts() {
  const [count, setCount] = useState(null)

  useEffect(() => {
    getContacts().then(c => setCount(c.length))
  }, [])

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-10 page-enter">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-tx-primary tracking-tight">Contacts</h1>
        {count !== null && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#EFF6FF', color: '#1D4ED8' }}
          >
            {count} saved
          </span>
        )}
      </div>
      <ContactList />
    </div>
  )
}
