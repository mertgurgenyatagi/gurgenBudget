import {
  collection,
  deleteDoc,
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
import { isBase, type BufferMode, type BufferSettings, type Category, type Item } from '../lib/formulas'
import { prevMonth, type DayKey, type MonthKey } from '../lib/time'

interface DataState {
  items: Item[]
  days: Map<DayKey, number>
  buffer: BufferSettings
  ready: boolean
  saveError: string | null
  clearSaveError: () => void
  addItem: (input: { category: Category; name: string; amount: number; month: MonthKey }) => void
  editItem: (item: Item, changes: { name?: string; amount?: number }, month: MonthKey) => void
  deleteItem: (item: Item, month: MonthKey) => void
  moveItem: (item: Item, category: Category) => void
  setPurchased: (item: Item, purchased: boolean) => void
  logDay: (day: DayKey, amount: number | null) => void
  setBuffer: (percent: number, mode: BufferMode, month: MonthKey) => void
}

const EMPTY_BUFFER: BufferSettings = { percent: 0, mode: 'slice', history: [] }

const DataContext = createContext<DataState | null>(null)

function itemFromDoc(id: string, raw: DocumentData): Item {
  return {
    id,
    category: raw.category,
    name: typeof raw.name === 'string' ? raw.name : '',
    amount: typeof raw.amount === 'number' ? raw.amount : 0,
    history: Array.isArray(raw.history) ? raw.history : [],
    createdMonth: raw.createdMonth,
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
  const [buffer, setBufferState] = useState<BufferSettings>(EMPTY_BUFFER)
  const [loaded, setLoaded] = useState({ items: false, days: false, buffer: false })
  const [saveError, setSaveError] = useState<string | null>(null)

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

    const unsubBuffer = onSnapshot(doc(db, 'users', uid, 'settings', 'buffer'), (snap) => {
      const raw = snap.data()
      setBufferState({
        percent: typeof raw?.percent === 'number' ? raw.percent : 0,
        mode: raw?.mode === 'surplus' ? 'surplus' : 'slice',
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
      setDoc(ref, {
        category,
        name,
        amount,
        history: [],
        createdMonth: month,
        deletedMonth: null,
        month: isBase(category) ? null : month,
        deleted: false,
        purchased: false,
      }).catch(report)
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
        deleteDoc(ref).catch(report)
      } else {
        setDoc(ref, { amount }).catch(report)
      }
    },
    [uid, report],
  )

  const setBuffer = useCallback<DataState['setBuffer']>(
    (percent, mode, month) => {
      if (!uid) return
      const boundary = prevMonth(month)
      const alreadyRecorded = buffer.history.some((entry) => entry.until === boundary)
      const changed = percent !== buffer.percent || mode !== buffer.mode
      const history =
        alreadyRecorded || !changed
          ? buffer.history
          : [...buffer.history, { percent: buffer.percent, mode: buffer.mode, until: boundary }]
      setDoc(doc(db, 'users', uid, 'settings', 'buffer'), { percent, mode, history }).catch(report)
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
