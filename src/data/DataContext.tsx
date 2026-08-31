import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthContext'
import { db } from '../firebase'
import { currentMonth, prevMonth, type DayKey, type MonthKey } from '../lib/time'
import { isBase, type Buffer, type Category, type Item } from '../lib/types'

interface DataState {
  items: Item[]
  days: Map<DayKey, number>
  buffer: Buffer
  ready: boolean
  saveError: string | null
  clearSaveError: () => void
  addItem: (input: { category: Category; name: string; amount: number; month: MonthKey }) => void
  editItem: (item: Item, changes: { name?: string; amount?: number }, month: MonthKey) => void
  deleteItem: (item: Item, month: MonthKey) => void
  moveItem: (item: Item, category: Category) => void
  setPurchased: (item: Item, purchased: boolean) => void
  logDay: (day: DayKey, amount: number | null) => void
  setBuffer: (amount: number, month: MonthKey) => void
}

const EMPTY_BUFFER: Buffer = { amount: 0, history: [] }

const DataContext = createContext<DataState | null>(null)

function itemFromDoc(id: string, raw: DocumentData): Item {
  return {
    id,
    category: raw.category,
    name: raw.name ?? '',
    amount: typeof raw.amount === 'number' ? raw.amount : 0,
    history: Array.isArray(raw.history) ? raw.history : [],
    createdMonth: raw.createdMonth ?? currentMonth(),
    deletedMonth: raw.deletedMonth ?? null,
    month: raw.month ?? null,
    deleted: raw.deleted === true,
    purchased: raw.purchased === true,
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.uid ?? null

  const [items, setItems] = useState<Item[]>([])
  const [days, setDays] = useState<Map<DayKey, number>>(new Map())
  const [buffer, setBufferState] = useState<Buffer>(EMPTY_BUFFER)
  const [loaded, setLoaded] = useState({ items: false, days: false, buffer: false })
  const [saveError, setSaveError] = useState<string | null>(null)

  // Live listeners — the screen updates itself the instant anything changes,
  // from this app, another tab, or another device.
  useEffect(() => {
    if (!uid) {
      setItems([])
      setDays(new Map())
      setBufferState(EMPTY_BUFFER)
      setLoaded({ items: false, days: false, buffer: false })
      return
    }

    const unsubItems = onSnapshot(collection(db, 'users', uid, 'items'), (snap) => {
      setItems(snap.docs.map((d) => itemFromDoc(d.id, d.data())))
      setLoaded((prev) => ({ ...prev, items: true }))
    })

    const unsubDays = onSnapshot(collection(db, 'users', uid, 'days'), (snap) => {
      const next = new Map<DayKey, number>()
      for (const d of snap.docs) {
        const amount = d.data().amount
        if (typeof amount === 'number') next.set(d.id, amount)
      }
      setDays(next)
      setLoaded((prev) => ({ ...prev, days: true }))
    })

    const unsubBuffer = onSnapshot(doc(db, 'users', uid, 'meta', 'buffer'), (snap) => {
      const raw = snap.data()
      setBufferState({
        amount: typeof raw?.amount === 'number' ? raw.amount : 0,
        history: Array.isArray(raw?.history) ? raw.history : [],
      })
      setLoaded((prev) => ({ ...prev, buffer: true }))
    })

    return () => {
      unsubItems()
      unsubDays()
      unsubBuffer()
    }
  }, [uid])

  const report = useCallback((error: unknown) => {
    console.error(error)
    setSaveError("Didn't save. Try again.")
  }, [])

  const addItem = useCallback<DataState['addItem']>(
    ({ category, name, amount, month }) => {
      if (!uid) return
      const ref = doc(collection(db, 'users', uid, 'items'))
      const payload = {
        category,
        name,
        amount,
        history: [],
        createdMonth: month,
        deletedMonth: null,
        month: isBase(category) ? null : month,
        deleted: false,
        purchased: false,
      }
      setDoc(ref, payload).catch(report)
    },
    [uid, report],
  )

  const editItem = useCallback<DataState['editItem']>(
    (item, changes, month) => {
      if (!uid) return
      const patch: Record<string, unknown> = {}
      if (changes.name !== undefined) patch.name = changes.name

      if (changes.amount !== undefined && changes.amount !== item.amount) {
        patch.amount = changes.amount
        // The new value counts as true since day 1 of this month, so the old one
        // applied through the month before. Editing twice in the same month must
        // not stack a second entry on top of that same boundary.
        const boundary = prevMonth(month)
        const alreadyRecorded = item.history.some((entry) => entry.until === boundary)
        if (!alreadyRecorded && month > item.createdMonth) {
          patch.history = [...item.history, { amount: item.amount, until: boundary }]
        }
      }

      if (Object.keys(patch).length === 0) return
      updateDoc(doc(db, 'users', uid, 'items', item.id), patch).catch(report)
    },
    [uid, report],
  )

  const deleteItem = useCallback<DataState['deleteItem']>(
    (item, month) => {
      if (!uid) return
      // Base items stop applying going forward; past months keep them exactly as they were.
      // Flex and Wishlist items get a quiet deleted flag as an accident backstop.
      const patch = isBase(item.category) ? { deletedMonth: month } : { deleted: true }
      updateDoc(doc(db, 'users', uid, 'items', item.id), patch).catch(report)
    },
    [uid, report],
  )

  const moveItem = useCallback<DataState['moveItem']>(
    (item, category) => {
      if (!uid) return
      updateDoc(doc(db, 'users', uid, 'items', item.id), {
        category,
        purchased: category === 'wishlist' ? item.purchased : false,
      }).catch(report)
    },
    [uid, report],
  )

  const setPurchased = useCallback<DataState['setPurchased']>(
    (item, purchased) => {
      if (!uid) return
      updateDoc(doc(db, 'users', uid, 'items', item.id), { purchased }).catch(report)
    },
    [uid, report],
  )

  const logDay = useCallback<DataState['logDay']>(
    (day, amount) => {
      if (!uid) return
      const ref = doc(db, 'users', uid, 'days', day)
      if (amount === null) {
        // Clearing a day returns it to "no entry", which counts as zero spent.
        updateDoc(ref, { amount: deleteField() }).catch(report)
      } else {
        setDoc(ref, { amount }, { merge: true }).catch(report)
      }
    },
    [uid, report],
  )

  const setBuffer = useCallback<DataState['setBuffer']>(
    (amount, month) => {
      if (!uid) return
      const boundary = prevMonth(month)
      const alreadyRecorded = buffer.history.some((entry) => entry.until === boundary)
      const history =
        alreadyRecorded || amount === buffer.amount
          ? buffer.history
          : [...buffer.history, { amount: buffer.amount, until: boundary }]
      setDoc(doc(db, 'users', uid, 'meta', 'buffer'), { amount, history }).catch(report)
    },
    [uid, buffer, report],
  )

  const value = useMemo<DataState>(
    () => ({
      items,
      days,
      buffer,
      ready: loaded.items && loaded.days && loaded.buffer,
      saveError,
      clearSaveError: () => setSaveError(null),
      addItem,
      editItem,
      deleteItem,
      moveItem,
      setPurchased,
      logDay,
      setBuffer,
    }),
    [
      items, days, buffer, loaded, saveError,
      addItem, editItem, deleteItem, moveItem, setPurchased, logDay, setBuffer,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataState {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
