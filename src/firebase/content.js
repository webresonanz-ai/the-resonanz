import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './config'

export const CONTENT_COLLECTIONS = {
  courses: { label: 'Courses & Fee', orderBy: 'name', direction: 'asc' },
  schedules: { label: 'Schedules', orderBy: 'date', direction: 'asc' },
  teachers: { label: 'Teachers', orderBy: 'name', direction: 'asc' },
  news: { label: 'News', orderBy: 'date', direction: 'desc' },
}

function getDatabase() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured. Add your credentials to the .env file and restart the dev server.')
  }
  return db
}

export function subscribeToContent(collectionName, sortField, direction, onData, onError) {
  const database = getDatabase()
  const contentQuery = query(
    collection(database, collectionName),
    orderBy(sortField, direction),
  )

  return onSnapshot(
    contentQuery,
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  )
}

export async function createContent(collectionName, fields) {
  const database = getDatabase()
  return addDoc(collection(database, collectionName), {
    ...fields,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateContent(collectionName, id, fields) {
  const database = getDatabase()
  return updateDoc(doc(database, collectionName, id), {
    ...fields,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteContent(collectionName, id) {
  const database = getDatabase()
  return deleteDoc(doc(database, collectionName, id))
}
