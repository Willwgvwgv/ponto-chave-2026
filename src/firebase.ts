import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged as realOnAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as realUpdateProfile
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  getFirestore, 
  collection as realCollection, 
  doc as realDoc, 
  setDoc as realSetDoc, 
  getDoc as realGetDoc, 
  getDocs as realGetDocs, 
  query as realQuery, 
  where as realWhere, 
  onSnapshot as realOnSnapshot, 
  addDoc as realAddDoc, 
  updateDoc as realUpdateDoc, 
  deleteDoc as realDeleteDoc, 
  serverTimestamp as realServerTimestamp, 
  Timestamp as realTimestamp, 
  arrayUnion as realArrayUnion,
  orderBy as realOrderBy,
  limit as realLimit,
  startAfter as realStartAfter,
  limitToLast as realLimitToLast
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { sanitizeForFirestore } from './lib/utils';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Detect if virtual environment defines VITE_FIREBASE_* environment variables (e.g. Vercel)
const env = (import.meta as any).env || {};

const hasEnvConfig = !!env.VITE_FIREBASE_API_KEY;

// Clean up database ID if it was misconfigured with placeholder URLs
const getSanitizedDatabaseId = () => {
  const envId = env.VITE_FIREBASE_DATABASE_ID;
  if (envId && (envId.startsWith("http") || envId.includes("example.com") || envId.trim() === "")) {
    return firebaseConfig.firestoreDatabaseId || "(default)";
  }
  return envId || firebaseConfig.firestoreDatabaseId || "(default)";
};

export const resolvedFirebaseConfig = hasEnvConfig ? {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: getSanitizedDatabaseId()
} : {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId
};

// Detect if Firebase has mock placeholder credentials or if the user forced demo mode
const isLocalOverride = typeof window !== 'undefined' && localStorage.getItem("pc_force_demo_mode") === "true";

export const isDemoMode = isLocalOverride || 
                          !resolvedFirebaseConfig.apiKey || 
                          resolvedFirebaseConfig.apiKey.includes("remixed") || 
                          resolvedFirebaseConfig.projectId.includes("remixed");

// Initialize Firebase SDK or Mocks gracefully
const app = initializeApp(resolvedFirebaseConfig);

export const auth = isDemoMode ? (() => {
  const defaultUser = {
    uid: "williangyn10_uid",
    email: "williangyn10@gmail.com",
    displayName: "Willian Admin",
    photoURL: "https://ui-avatars.com/api/?name=Admin&background=random",
    emailVerified: true,
    isAnonymous: false,
    tenantId: null,
    providerData: []
  };

  const getPersistedUser = () => {
    const stored = localStorage.getItem("pc_auth_user");
    if (stored) {
      if (stored === "null") return null;
      try {
        return JSON.parse(stored);
      } catch {
        return defaultUser;
      }
    }
    return defaultUser; // Start with the master admin signed in by default!
  };

  const setPersistedUser = (user: any) => {
    localStorage.setItem("pc_auth_user", user ? JSON.stringify(user) : "null");
  };

  const mockAuthObj = {
    get currentUser() {
      return getPersistedUser();
    },
    signOut: async () => {
      setPersistedUser(null);
      triggerAuthListeners(null);
    }
  };
  return mockAuthObj as any;
})() : getAuth(app);

export const db = isDemoMode ? { _type: 'db_mock' } as any : getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId);
export const storage = isDemoMode ? null as any : getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Local Storage Helper functions for Demo Mode
function getLocalCollection(collectionPath: string): Record<string, any> {
  const raw = localStorage.getItem(`pc_db_${collectionPath}`);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to parse collection", collectionPath, error);
    return {};
  }
}

function setLocalCollection(collectionPath: string, data: Record<string, any>) {
  localStorage.setItem(`pc_db_${collectionPath}`, JSON.stringify(data));
  triggerSnapshotListeners(collectionPath);
}

// Seed Initial Demo/Local Data
if (isDemoMode) {
  const isDemoInitialized = localStorage.getItem('pc_demo_initialized');
  if (!isDemoInitialized) {
    const defaultCompany = {
      name: "Ponto Chave Imóveis",
      subtitle: "Gestão de Fluxos e Processos Imobiliários",
      logoUrl: ""
    };
    localStorage.setItem('pc_db_companies', JSON.stringify({
      "company": defaultCompany
    }));

    const defaultUser = {
      uid: "williangyn10_uid",
      displayName: "Willian Admin",
      email: "williangyn10@gmail.com",
      role: "admin",
      companyId: "company",
      status: "active"
    };
    localStorage.setItem('pc_db_users', JSON.stringify({
      "williangyn10_uid": defaultUser
    }));

    const defaultTasks = {
      "task_1": {
        id: "task_1",
        title: "Vistoria pré-entrega de chaves - Apt 104",
        description: "Realizar vistoria fotográfica completa e checklist detalhado do imóvel antes de entregar as chaves.",
        priority: "high",
        status: "pending",
        category: "vistoria",
        companyId: "company",
        uid: "williangyn10_uid",
        createdAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
      },
      "task_2": {
        id: "task_2",
        title: "Assinatura do contrato de locação - Residencial Harmonia",
        description: "Acompanhar a assinatura eletrônica dos locatários e fiadores.",
        priority: "medium",
        status: "completed",
        category: "contrato",
        companyId: "company",
        uid: "williangyn10_uid",
        createdAt: new Date().toISOString(),
        dueDate: new Date().toISOString(),
      }
    };
    localStorage.setItem('pc_db_tasks', JSON.stringify(defaultTasks));

    const defaultBankAccounts = {
      "acc_1": {
        id: "acc_1",
        name: "Banco do Brasil - Conta Operacional",
        bank: "001",
        agency: "1234",
        account: "56789-0",
        balance: 154300.00,
        description: "Conta principal para pagamento de comissões e despesas.",
        companyId: "company"
      },
      "acc_2": {
        id: "acc_2",
        name: "Itaú - Recebimento de Aluguéis",
        bank: "341",
        agency: "4321",
        account: "98765-4",
        balance: 89050.25,
        description: "Conta de repasse e liquidação de contratos de locação.",
        companyId: "company"
      }
    };
    localStorage.setItem('pc_db_bank_accounts', JSON.stringify(defaultBankAccounts));

    const defaultFinancialCategories = {
      "cat_1": { id: "cat_1", name: "Receita de Aluguel", type: "income", companyId: "company" },
      "cat_2": { id: "cat_2", name: "Receita de Corretagem", type: "income", companyId: "company" },
      "cat_3": { id: "cat_3", name: "Salários e Pró-labore", type: "expense", companyId: "company" },
      "cat_4": { id: "cat_4", name: "Marketing e Anúncios", type: "expense", companyId: "company" },
      "cat_5": { id: "cat_5", name: "Aluguel e Infraestrutura", type: "expense", companyId: "company" }
    };
    localStorage.setItem('pc_db_financial_categories', JSON.stringify(defaultFinancialCategories));

    const defaultSales = {
      "sale_1": {
        id: "sale_1",
        agency_id: "company",
        buyer_name: "Guilherme Santos",
        seller_name: "Construtora Rossi",
        property_address: "Apto 1502 - Ed. Alameda",
        sale_value: 650000.00,
        commission_percentage: 6,
        total_commission: 39000.00,
        sale_date: new Date().toISOString(),
        status: "received"
      },
      "sale_2": {
        id: "sale_2",
        agency_id: "company",
        buyer_name: "Mariana Alencar",
        seller_name: "Carlos Eduardo da Silva",
        property_address: "Casa Térrea - Condomínio Royal",
        sale_value: 1200000.00,
        commission_percentage: 5,
        total_commission: 60000.00,
        sale_date: new Date(Date.now() - 86400000 * 5).toISOString(),
        status: "pending_invoice"
      }
    };
    localStorage.setItem('pc_db_sales', JSON.stringify(defaultSales));

    const defaultVistorias = {
      "vist_1": {
        id: "vist_1",
        address: "Apt 203 - Condomínio Bela Vista",
        proprietario: "Roberto Andrade",
        inquilino: "Ana Clara Lima",
        status: "concluida",
        dataVistoria: new Date().toISOString(),
        checklist: [
          { id: "1", item: "Chaves entregues", ok: true, obs: "3 cópias completas" },
          { id: "2", item: "Pintura geral", ok: true, obs: "Pintura nova fosca" },
          { id: "3", item: "Lâmpadas funcionando", ok: false, obs: "Lâmpada da varanda queimada" },
          { id: "4", item: "Vidros e janelas íntegros", ok: true, obs: "" }
        ],
        fotos: [],
        assinaturaDigital: "Ana Clara Lima",
        observacoes: "Vistoria realizada com presença do inquilino."
      }
    };
    localStorage.setItem('pc_db_vistorias', JSON.stringify(defaultVistorias));

    localStorage.setItem('pc_demo_initialized', 'true');
  }
}

// Real-time snapshot listener mechanism for Demo Mode
const snapshotListeners = new Set<{
  path: string;
  isDoc: boolean;
  callback: (snapshot: any) => void;
}>();

function triggerSnapshotListeners(path: string) {
  snapshotListeners.forEach(listener => {
    const listenerBaseColl = listener.path.split('/')[0];
    const triggerBaseColl = path.split('/')[0];
    if (listenerBaseColl === triggerBaseColl) {
      let snapshot: any;
      if (listener.isDoc) {
        const parts = listener.path.split('/');
        const id = parts[parts.length - 1];
        const collectionPath = parts.slice(0, parts.length - 1).join('/');
        const coll = getLocalCollection(collectionPath);
        const data = coll[id];
        snapshot = {
          exists: () => data !== undefined,
          id,
          data: () => data
        };
      } else {
        const coll = getLocalCollection(listener.path);
        const docs = Object.entries(coll).map(([id, val]) => ({
          id,
          data: () => val,
          exists: () => true
        }));
        snapshot = {
          empty: docs.length === 0,
          docs,
          forEach: (callback: (doc: any) => void) => {
            docs.forEach(callback);
          }
        };
      }
      setTimeout(() => {
        listener.callback(snapshot);
      }, 10);
    }
  });
}

const authListeners = new Set<(user: any) => void>();
function triggerAuthListeners(user: any) {
  authListeners.forEach(cb => cb(user));
}

// Auth Helpers
export const loginWithGoogle = isDemoMode ? async () => {
  const loggedUser = {
    uid: "williangyn10_uid",
    email: "williangyn10@gmail.com",
    displayName: "Willian Admin",
    photoURL: "https://ui-avatars.com/api/?name=Admin&background=random",
    emailVerified: true,
    isAnonymous: false,
    tenantId: null,
    providerData: []
  };
  localStorage.setItem("pc_auth_user", JSON.stringify(loggedUser));
  triggerAuthListeners(loggedUser);
  return { user: loggedUser };
} : () => signInWithPopup(auth, googleProvider);

export const loginWithEmail = isDemoMode ? async (email: string, pass: string) => {
  const loggedUser = {
    uid: "williangyn10_uid",
    email: email || "williangyn10@gmail.com",
    displayName: email ? email.split('@')[0] : "Admin",
    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(email || "Admin")}&background=random`,
    emailVerified: true,
    isAnonymous: false,
    tenantId: null,
    providerData: []
  };
  localStorage.setItem("pc_auth_user", JSON.stringify(loggedUser));
  triggerAuthListeners(loggedUser);
  return { user: loggedUser };
} : (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);

export const registerWithEmail = isDemoMode ? async (email: string, pass: string) => {
  return loginWithEmail(email, pass);
} : (email: string, pass: string) => createUserWithEmailAndPassword(auth, email, pass);

export const logout = isDemoMode ? async () => {
  localStorage.setItem("pc_auth_user", "null");
  triggerAuthListeners(null);
} : () => signOut(auth);

export const updateProfile = isDemoMode ? async (user: any, profileData: any) => {
  const current = JSON.parse(localStorage.getItem("pc_auth_user") || "null");
  if (current) {
    const updated = { ...current, ...profileData };
    localStorage.setItem("pc_auth_user", JSON.stringify(updated));
    triggerAuthListeners(updated);
  }
} : realUpdateProfile;

export const onAuthStateChanged = (authInstance: any, callback: (user: any) => void) => {
  if (isDemoMode) {
    authListeners.add(callback);
    // Defer triggering to let App render loading state first
    setTimeout(() => {
      callback(mockCurrentPersistedUser());
    }, 150);
    return () => {
      authListeners.delete(callback);
    };
  } else {
    return realOnAuthStateChanged(authInstance, callback);
  }
};

function mockCurrentPersistedUser() {
  const stored = localStorage.getItem("pc_auth_user");
  if (stored) {
    if (stored === "null") return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return {
    uid: "williangyn10_uid",
    email: "williangyn10@gmail.com",
    displayName: "Willian Admin",
    photoURL: "https://ui-avatars.com/api/?name=Admin&background=random"
  };
}

// Firestore Export wrappers
export function collection(dbInstance: any, path: string, ...segments: string[]) {
  if (isDemoMode) {
    const fullPath = [path, ...segments].join('/');
    return { _type: 'collection', path: fullPath };
  }
  return realCollection(dbInstance, path, ...segments);
}

export function doc(first: any, second?: string, ...segments: string[]) {
  if (isDemoMode) {
    let fullPath = '';
    if (first && first._type === 'collection') {
      fullPath = first.path + (second ? '/' + second : '');
    } else {
      fullPath = second || '';
    }
    if (segments.length > 0) {
      fullPath += '/' + segments.join('/');
    }
    const parts = fullPath.split('/');
    const id = parts[parts.length - 1];
    const collectionPath = parts.slice(0, parts.length - 1).join('/');
    return { _type: 'doc', path: fullPath, id, collectionPath };
  }
  return realDoc(first, second, ...segments);
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  const sanitized = sanitizeForFirestore(data);
  if (isDemoMode) {
    const coll = getLocalCollection(docRef.collectionPath);
    const existing = coll[docRef.id] || {};
    const updated = options?.merge ? { ...existing, ...sanitized } : sanitized;
    coll[docRef.id] = updated;
    setLocalCollection(docRef.collectionPath, coll);
    return;
  }
  return realSetDoc(docRef, sanitized, options);
}

export async function getDoc(docRef: any) {
  if (isDemoMode) {
    const coll = getLocalCollection(docRef.collectionPath);
    const data = coll[docRef.id];
    return {
      exists: () => data !== undefined,
      id: docRef.id,
      data: () => data
    };
  }
  return realGetDoc(docRef);
}

export async function getDocs(queryRef: any) {
  if (isDemoMode) {
    const path = queryRef.path || (queryRef.collectionRef ? queryRef.collectionRef.path : queryRef);
    const coll = getLocalCollection(path);
    const docs = Object.entries(coll).map(([id, val]) => ({
      id,
      data: () => val,
      exists: () => true
    }));

    let filteredDocs = docs;
    if (queryRef && queryRef.filters && queryRef.filters.length > 0) {
      filteredDocs = docs.filter(docSnap => {
        const docData = docSnap.data();
        if (!docData) return false;
        for (const filter of queryRef.filters) {
          const { field, op, value } = filter;
          const actual = docData[field];
          if (op === '==') {
            if (actual !== value) return false;
          } else if (op === '!=') {
            if (actual === value) return false;
          } else if (op === 'array-contains') {
            if (!Array.isArray(actual) || !actual.includes(value)) return false;
          }
        }
        return true;
      });
    }

    return {
      empty: filteredDocs.length === 0,
      docs: filteredDocs,
      forEach: (callback: (doc: any) => void) => {
        filteredDocs.forEach(callback);
      }
    };
  }
  return realGetDocs(queryRef);
}

export function query(collectionRef: any, ...constraints: any[]) {
  if (isDemoMode) {
    const filters: any[] = [];
    const orders: any[] = [];
    let limitVal = null;
    
    constraints.forEach(c => {
      if (c && c._type === 'where') {
        filters.push({ field: c.field, op: c.op, value: c.value });
      } else if (c && c._type === 'orderBy') {
        orders.push({ field: c.field, dir: c.dir });
      } else if (c && c._type === 'limit') {
        limitVal = c.value;
      }
    });

    return {
      _type: 'query',
      collectionRef,
      path: collectionRef?.path || '',
      filters,
      orders,
      limitVal
    };
  }
  return realQuery(collectionRef, ...constraints);
}

export function where(field: string, op: any, value: any) {
  if (isDemoMode) {
    return { _type: 'where', field, op, value };
  }
  return realWhere(field, op, value);
}

export function orderBy(field: string, dir: "asc" | "desc" = "asc") {
  if (isDemoMode) {
    return { _type: 'orderBy', field, dir };
  }
  return realOrderBy(field, dir);
}

export function limit(value: number) {
  if (isDemoMode) {
    return { _type: 'limit', value };
  }
  return realLimit(value);
}

export function startAfter(value: any) {
  if (isDemoMode) return { _type: 'startAfter', value };
  return realStartAfter(value);
}

export function limitToLast(value: any) {
  if (isDemoMode) return { _type: 'limitToLast', value };
  return realLimitToLast(value);
}

export function onSnapshot(ref: any, callback: (snapshot: any) => void, onError?: (error: any) => void) {
  if (isDemoMode) {
    const isDoc = ref && ref._type === 'doc';
    const path = ref && ref.path;
    const listener = { path, isDoc, callback };
    snapshotListeners.add(listener);

    let initialSnapshot: any;
    if (isDoc) {
      const coll = getLocalCollection(ref.collectionPath);
      const data = coll[ref.id];
      initialSnapshot = {
        exists: () => data !== undefined,
        id: ref.id,
        data: () => data
      };
    } else {
      const pathValue = ref.path || ref.collectionRef?.path || ref || '';
      const coll = getLocalCollection(pathValue);
      const docs = Object.entries(coll).map(([id, val]) => ({
        id,
        data: () => val,
        exists: () => true
      }));
      initialSnapshot = {
        empty: docs.length === 0,
        docs,
        forEach: (cb: (doc: any) => void) => {
          docs.forEach(cb);
        }
      };
    }
    
    setTimeout(() => {
      callback(initialSnapshot);
    }, 50);

    return () => {
      snapshotListeners.delete(listener);
    };
  }
  return realOnSnapshot(ref, callback, onError);
}

export async function addDoc(collectionRef: any, data: any) {
  const sanitized = sanitizeForFirestore(data);
  if (isDemoMode) {
    const id = "doc_" + Math.random().toString(36).substring(2, 9);
    const coll = getLocalCollection(collectionRef.path);
    const enriched = { ...sanitized, id };
    coll[id] = enriched;
    setLocalCollection(collectionRef.path, coll);
    return { id, path: `${collectionRef.path}/${id}` };
  }
  return realAddDoc(collectionRef, sanitized);
}

export async function updateDoc(docRef: any, data: any) {
  const sanitized = sanitizeForFirestore(data);
  if (isDemoMode) {
    const coll = getLocalCollection(docRef.collectionPath);
    const existing = coll[docRef.id] || {};
    const updated = { ...existing };
    for (const key in sanitized) {
      const val = sanitized[key];
      if (val && typeof val === 'object' && val._type === 'arrayUnion') {
        const arr = Array.isArray(updated[key]) ? updated[key] : [];
        updated[key] = [...arr, ...val.values];
      } else {
        updated[key] = val;
      }
    }
    coll[docRef.id] = updated;
    setLocalCollection(docRef.collectionPath, coll);
    return;
  }
  return realUpdateDoc(docRef, sanitized);
}

export async function deleteDoc(docRef: any) {
  if (isDemoMode) {
    const coll = getLocalCollection(docRef.collectionPath);
    delete coll[docRef.id];
    setLocalCollection(docRef.collectionPath, coll);
    return;
  }
  return realDeleteDoc(docRef);
}

export function arrayUnion(...values: any[]) {
  if (isDemoMode) {
    return { _type: 'arrayUnion', values };
  }
  return realArrayUnion(...values);
}

export const serverTimestamp = () => {
  if (isDemoMode) return new Date().toISOString();
  return realServerTimestamp();
};

export class Timestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static now() {
    const d = new Date();
    return new Timestamp(Math.floor(d.getTime() / 1000), 0);
  }
  static fromDate(date: Date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), 0);
  }
  toDate() {
    return new Date(this.seconds * 1000);
  }
}

export type { User };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isDemoMode) {
    console.warn("MOCK Firestore warning:", error, operationType, path);
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
