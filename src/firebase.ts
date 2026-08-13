import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged as realOnAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail as realSendPasswordResetEmail,
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
  limitToLast as realLimitToLast,
  writeBatch as realWriteBatch,
  runTransaction as realRunTransaction
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { sanitizeForFirestore } from './lib/utils';
import { toast } from 'sonner';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Detect if virtual environment defines VITE_FIREBASE_* environment variables (e.g. Vercel)
const env = (import.meta as any).env || {};

const cleanStr = (val: any): string => {
  if (!val || typeof val !== 'string') return '';
  // Remove whitespace and any single or double quotes around the value
  return val.replace(/[\r\n\s\t]/g, '').replace(/^['"]|['"]$/g, '');
};

// Clean up database ID if it was misconfigured with placeholder URLs
const getSanitizedDatabaseId = () => {
  const envId = cleanStr(env.VITE_FIREBASE_DATABASE_ID);
  if (envId && (envId.startsWith("http") || envId.includes("example.com") || envId === "")) {
    return cleanStr(firebaseConfig.firestoreDatabaseId) || "(default)";
  }
  return envId || cleanStr(firebaseConfig.firestoreDatabaseId) || "(default)";
};

const isValidApiKey = (key: any): boolean => {
  if (!key || typeof key !== 'string') return false;
  const k = cleanStr(key);
  if (k === '' || k === 'undefined' || k === 'null') return false;
  if (!k.startsWith('AIzaSy')) return false;
  if (k.length < 25) return false;
  if (/placeholder/i.test(k) || /replace/i.test(k) || /your[-_]api/i.test(k)) return false;
  return true;
};

const isEnvApiValid = isValidApiKey(env.VITE_FIREBASE_API_KEY);

const isEnvConfigComplete = isEnvApiValid && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_PROJECT_ID !== 'undefined' && env.VITE_FIREBASE_PROJECT_ID !== 'null';

const isAIStudioPreview = typeof window !== 'undefined' && (
  window.location.hostname.includes('.run.app') || 
  window.location.hostname.includes('web-preview') || 
  window.location.hostname.includes('aistudio')
);

const useEnvConfig = isAIStudioPreview ? isEnvConfigComplete : (isEnvConfigComplete || !!env.VITE_FIREBASE_API_KEY);

const resolvedProjectId = cleanStr((useEnvConfig && env.VITE_FIREBASE_PROJECT_ID) ? env.VITE_FIREBASE_PROJECT_ID : firebaseConfig.projectId);

const getStorageBucket = () => {
  const envBucket = useEnvConfig ? cleanStr(env.VITE_FIREBASE_STORAGE_BUCKET) : '';
  if (envBucket) return envBucket;
  
  const configBucket = cleanStr(firebaseConfig.storageBucket);
  if (configBucket) return configBucket;
  
  if (useEnvConfig && env.VITE_FIREBASE_PROJECT_ID) {
    const cleanProj = cleanStr(env.VITE_FIREBASE_PROJECT_ID);
    return `${cleanProj}.firebasestorage.app`;
  }
  
  if (resolvedProjectId) {
    return `${resolvedProjectId}.firebasestorage.app`;
  }
  return '';
};

const getAuthDomain = () => {
  const envDomain = useEnvConfig ? cleanStr(env.VITE_FIREBASE_AUTH_DOMAIN) : '';
  if (envDomain) return envDomain;
  
  if (useEnvConfig && env.VITE_FIREBASE_PROJECT_ID) {
    const cleanProj = cleanStr(env.VITE_FIREBASE_PROJECT_ID);
    return `${cleanProj}.firebaseapp.com`;
  }
  
  const configDomain = cleanStr(firebaseConfig.authDomain);
  if (configDomain) return configDomain;
  
  if (resolvedProjectId) {
    return `${resolvedProjectId}.firebaseapp.com`;
  }
  return '';
};

export const resolvedFirebaseConfig = {
  apiKey: cleanStr(useEnvConfig ? env.VITE_FIREBASE_API_KEY : firebaseConfig.apiKey),
  authDomain: getAuthDomain(),
  projectId: resolvedProjectId,
  storageBucket: getStorageBucket(),
  messagingSenderId: cleanStr((useEnvConfig && env.VITE_FIREBASE_MESSAGING_SENDER_ID) ? env.VITE_FIREBASE_MESSAGING_SENDER_ID : firebaseConfig.messagingSenderId),
  appId: cleanStr((useEnvConfig && env.VITE_FIREBASE_APP_ID) ? env.VITE_FIREBASE_APP_ID : firebaseConfig.appId),
  firestoreDatabaseId: useEnvConfig ? getSanitizedDatabaseId() : (cleanStr(firebaseConfig.firestoreDatabaseId) || "(default)")
};

// Log masked configuration for debugging purposes, but do not leak secrets
if (typeof window !== 'undefined') {
  const maskString = (str: string) => {
    if (!str) return 'empty';
    if (str.length <= 10) return '*'.repeat(str.length);
    return str.substring(0, 6) + '...' + str.substring(str.length - 4);
  };
  console.log("🔥 Firebase Init Config:", {
    projectId: resolvedFirebaseConfig.projectId,
    databaseId: resolvedFirebaseConfig.firestoreDatabaseId,
    apiKey: maskString(resolvedFirebaseConfig.apiKey),
    isEnvApiValid
  });
}

// Detect if Firebase has mock placeholder credentials or if the user forced demo mode
const isLocalOverride = typeof window !== 'undefined' && localStorage.getItem("pc_force_demo_mode") === "true";

export const isDemoMode = isLocalOverride || 
                          !resolvedFirebaseConfig.apiKey || 
                          resolvedFirebaseConfig.apiKey.includes("remixed") || 
                          resolvedFirebaseConfig.projectId.includes("remixed");

// Initialize Firebase SDK or Mocks gracefully
const app = initializeApp(resolvedFirebaseConfig);

// Diagnostic Logs requested by the user
const debugFirebase = typeof window !== 'undefined' && ((import.meta as any).env?.DEV || localStorage.getItem("VITE_DEBUG_FIREBASE") === "true");

if (debugFirebase) {
  console.log("=== DIAGNOSTICO FIREBASE ===");
  console.log("Firebase resolvedFirebaseConfig:", {
    projectId: resolvedFirebaseConfig.projectId,
    authDomain: resolvedFirebaseConfig.authDomain,
    storageBucket: resolvedFirebaseConfig.storageBucket,
    firestoreDatabaseId: resolvedFirebaseConfig.firestoreDatabaseId
  });
  
  // Safe sanitized snapshot exposed to window to prevent exposing raw keys/secrets in production
  (window as any).__firebaseDebug = {
    projectId: app.options.projectId,
    storageBucket: app.options.storageBucket,
    authDomain: app.options.authDomain,
    currentUser: null
  };
}

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

export const db = isDemoMode ? { _type: 'db_mock' } as any : (
  (resolvedFirebaseConfig.firestoreDatabaseId && resolvedFirebaseConfig.firestoreDatabaseId !== "(default)")
    ? getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId)
    : getFirestore(app)
);
export const storage = isDemoMode ? null as any : getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export interface UploadDiagnostics {
  beforeUpload: (storageRef: any, blob: Blob) => Promise<void>;
  success: (snapshot: any, downloadUrl: string) => void;
  error: (err: any) => void;
  getReport: () => any;
  setPhase?: (phase: "prepare" | "auth" | "createReference" | "uploadStarted" | "uploadFinished" | "downloadUrl") => void;
}

// Persistent Session ID for the active runtime instance of the app
const sessionUUID = typeof crypto !== 'undefined' && crypto.randomUUID 
  ? crypto.randomUUID() 
  : Math.random().toString(36).substring(2, 15) + '-' + Date.now();

/**
 * Creates a diagnostic telemetry session for a single file upload.
 * Consolidates browser, build, connection, auth, and performance data into a unified, clean console flow.
 */
export function createUploadDiagnostics(uploadId?: string): UploadDiagnostics {
  const uid = uploadId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));
  let startTime = 0;
  let cachedRef: any = null;
  let cachedBlob: Blob | null = null;

  // Structured diagnostic data that can be exported as a JSON report
  const report: any = {
    trace: {
      sessionId: sessionUUID,
      uploadId: uid,
      correlationId: uid,
      traceId: `${sessionUUID.substring(0, 8)}-${uid.substring(0, 8)}`
    },
    diagnosticEngine: {
      version: "1.6.0",
      heuristicsVersion: "2026-07-v2"
    },
    status: "PENDING",
    uploadPhase: "prepare",
    performance: {
      durationMs: null
    },
    buildInfo: {
      appVersion: "1.6.0-expert-telemetry",
      buildDate: "2026-07-06",
      environment: (import.meta as any).env?.MODE || "production",
      isDemoMode,
      deployEnvironment: typeof window !== 'undefined' ? (
        window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1') ? 'development' :
        window.location.hostname.includes('ais-dev') ? 'development-preview' : 'production'
      ) : 'unknown',
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A'
    },
    browser: {},
    firebaseOptions: {},
    fileDetails: {},
    auth: {},
    timeline: [],
    healthChecks: {
      firebaseInitialized: !isDemoMode && !!app,
      authenticated: false,
      tokenValid: false,
      bucketResolved: false,
      bucketName: "N/A",
      bucketExpected: "N/A",
      bucketMatchesExpected: false,
      projectIdResolved: "N/A",
      networkOnline: true,
      preflightSucceeded: null,
      uploadSucceeded: false,
      downloadUrlGenerated: false
    },
    errorLayers: {
      browserLayer: null,
      httpNetworkLayer: null,
      sdkLayer: null,
      businessLayer: null
    },
    possibleCauses: [],
    rootCauseAnalysis: null,
    errorDetails: null,
    successDetails: null
  };

  const addTimelineEvent = (event: string) => {
    const elapsed = startTime > 0 ? `${(performance.now() - startTime).toFixed(0)}ms` : "0ms";
    report.timeline.push(`[${elapsed}] ${event}`);
  };

  startTime = performance.now();
  addTimelineEvent("Sessão de diagnóstico criada.");

  return {
    beforeUpload: async (storageRef: any, blob: Blob) => {
      cachedRef = storageRef;
      cachedBlob = blob;
      report.uploadPhase = "createReference";
      addTimelineEvent("Antes do Upload: Analisando metadados do arquivo, rede e estado de autenticação.");

      const timestamp = new Date().toISOString();
      report.timestampUtc = timestamp;

      // Capture Connection Info if browser supports Network Information API
      let networkConn: any = null;
      if (typeof navigator !== 'undefined') {
        const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        if (conn) {
          networkConn = {
            effectiveType: conn.effectiveType || "N/A",
            rtt: conn.rtt !== undefined ? conn.rtt : "N/A",
            downlink: conn.downlink !== undefined ? conn.downlink : "N/A"
          };
        }
      }

      // Capture browser details
      const browserInfo = typeof navigator !== 'undefined' ? {
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        language: navigator.language,
        platform: navigator.platform,
        connection: networkConn
      } : {};

      report.browser = browserInfo;
      report.healthChecks.networkOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      addTimelineEvent("Metadados do navegador e rede coletados.");

      // Capture Firebase client config options
      const firebaseOpts = !isDemoMode && app ? {
        projectId: app.options.projectId || "N/A",
        storageBucket: app.options.storageBucket || "N/A",
        authDomain: app.options.authDomain || "N/A"
      } : { demo: true };

      report.firebaseOptions = firebaseOpts;

      // Capture file details
      const fileDetails = {
        fullPath: storageRef?.fullPath || "N/A",
        bucket: storageRef?.bucket || "N/A",
        name: storageRef?.name || "N/A",
        contentType: blob.type,
        sizeBytes: blob.size,
        sizeKb: `${(blob.size / 1024).toFixed(2)} KB`
      };

      report.fileDetails = fileDetails;
      report.healthChecks.bucketResolved = !!(storageRef?.bucket);
      report.healthChecks.bucketName = storageRef?.bucket || "N/A";
      report.healthChecks.bucketExpected = (!isDemoMode && app && app.options.storageBucket) ? app.options.storageBucket : "N/A";
      report.healthChecks.bucketMatchesExpected = (!isDemoMode && app && storageRef?.bucket) ? (storageRef.bucket === app.options.storageBucket) : true;
      report.healthChecks.projectIdResolved = (!isDemoMode && app && app.options.projectId) ? app.options.projectId : "N/A";
      
      addTimelineEvent("Identificadores e tamanho do arquivo mapeados com correspondência de bucket.");
      
      report.uploadPhase = "auth";

      // Get safe Auth details
      let authDetails: any = { isAuthenticated: false };
      if (!isDemoMode && auth && auth.currentUser) {
        authDetails.isAuthenticated = true;
        authDetails.uid = auth.currentUser.uid;
        authDetails.email = auth.currentUser.email;
        report.healthChecks.authenticated = true;
        try {
          addTimelineEvent("Solicitando IdToken do Firebase Auth.");
          const tokenResult = await auth.currentUser.getIdTokenResult();
          authDetails.issuedAt = tokenResult.issuedAtTime;
          authDetails.expirationTime = tokenResult.expirationTime;
          authDetails.authTime = tokenResult.authTime;
          report.healthChecks.tokenValid = true;
          addTimelineEvent("Token ID do Firebase Auth resolvido e validado.");
        } catch (tokenErr: any) {
          authDetails.tokenError = tokenErr?.message || "Erro ao ler token";
          report.healthChecks.tokenValid = false;
          addTimelineEvent(`Aviso: Falha ao obter IdTokenResult: ${tokenErr?.message || 'Erro'}`);
        }
      } else if (isDemoMode) {
        authDetails.isDemoUser = true;
        report.healthChecks.authenticated = true;
        report.healthChecks.tokenValid = true;
        addTimelineEvent("Modo de demonstração offline ativo (Sem autenticação real).");
      } else {
        report.healthChecks.authenticated = false;
        report.healthChecks.tokenValid = false;
        addTimelineEvent("ALERTA CRÍTICO: Nenhum usuário autenticado detectado.");
      }

      report.auth = authDetails;
      report.uploadPhase = "uploadStarted";
      addTimelineEvent("Pré-validações concluídas. Iniciando chamada de rede uploadBytes().");

      // Output beautifully structured consolidated single console.group
      console.group(`=== TELEMETRIA [SESSÃO: ${sessionUUID.substring(0, 8)}] [UPLOAD: ${uid.substring(0, 8)}] ===`);
      console.log(`[INFO] [${timestamp}] Upload iniciado.`);
      console.log("► Identificação e Trace:", report.trace);
      console.log("► Motor de Heurísticas:", report.diagnosticEngine);
      console.log("► Informações Gerais:", report.buildInfo);
      console.log("► Navegador e Rede:", report.browser);
      console.log("► Configuração Firebase:", report.firebaseOptions);
      console.log("► Detalhes do Arquivo:", report.fileDetails);
      console.log("► Estado da Autenticação:", report.auth);
      console.log("► Validações de Saúde (Health Checks):", report.healthChecks);
      console.log("► Linha do Tempo:", report.timeline);
      console.groupEnd();
    },

    success: (snapshot: any, downloadUrl: string) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const timestamp = new Date().toISOString();

      addTimelineEvent(`Upload finalizado com sucesso. Referência criada: ${snapshot?.ref?.fullPath || 'N/A'}`);
      report.uploadPhase = "uploadFinished";
      addTimelineEvent(`Geração da URL de download concluída.`);
      report.uploadPhase = "downloadUrl";

      report.status = "SUCCESS";
      report.performance.durationMs = duration.toFixed(2);
      report.healthChecks.uploadSucceeded = true;
      report.healthChecks.downloadUrlGenerated = !!downloadUrl;
      if (report.healthChecks.preflightSucceeded === null) {
        report.healthChecks.preflightSucceeded = true;
      }

      const successDetails = {
        downloadURL: downloadUrl,
        fullPath: snapshot?.ref?.fullPath || cachedRef?.fullPath,
        bucket: snapshot?.ref?.bucket || cachedRef?.bucket,
        name: snapshot?.ref?.name || cachedRef?.name,
        metadata: snapshot?.metadata || {}
      };
      report.successDetails = successDetails;

      console.group(`=== UPLOAD SUCESSO [SESSÃO: ${sessionUUID.substring(0, 8)}] [UPLOAD: ${uid.substring(0, 8)}] ===`);
      console.log(`[INFO] [${timestamp}] Upload finalizado com sucesso após ${duration.toFixed(2)}ms.`);
      console.log("► Detalhes do Objeto Criado:", report.successDetails);
      console.log("► Validações de Saúde (Health Checks):", report.healthChecks);
      console.log("► Linha do Tempo de Eventos:", report.timeline);
      console.groupEnd();

      // Expose to window helper for developer copying
      if (typeof window !== 'undefined') {
        (window as any).__lastUploadDiagnostic = report;
        const history = (window as any).__uploadDiagnosticsHistory || [];
        history.push(report);
        // Prevent memory growth over 100 entries
        const MAX_HISTORY = 100;
        while (history.length > MAX_HISTORY) {
          history.shift();
        }
        (window as any).__uploadDiagnosticsHistory = history;
      }
    },

    error: (err: any) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const timestamp = new Date().toISOString();

      addTimelineEvent(`Exceção capturada no fluxo de upload: ${err?.code || err?.message || 'Erro sem código'}`);

      report.status = "ERROR";
      report.performance.durationMs = duration.toFixed(2);
      report.healthChecks.uploadSucceeded = false;
      report.healthChecks.downloadUrlGenerated = false;

      const isFirebaseError = err && (err.name === 'FirebaseError' || typeof err.code === 'string');
      const errCode = err?.code || "N/A";
      const isCorsSuspect = errCode === 'storage/unknown' || err?.message?.toLowerCase().includes('cors') || (err?.serverResponse && err.serverResponse.toLowerCase().includes('cors'));
      const hasAuth = report.auth?.isAuthenticated;
      const isOnline = report.browser?.online ?? true;

      // 1. Layered Error Categorization (Camadas de Observabilidade)
      const browserLayer = typeof navigator !== 'undefined' ? {
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        connection: report.browser?.connection || null,
        offlineDetected: !navigator.onLine
      } : { online: true };

      const httpNetworkLayer = {
        inferredMethod: isCorsSuspect ? "OPTIONS (Preflight)" : "POST (Upload)",
        inferredStatus: errCode === 'storage/unauthorized' ? 403 :
                        errCode === 'storage/object-not-found' ? 404 :
                        isCorsSuspect ? "OPTIONS_BLOCKED_403_CORS" : "UNKNOWN_HTTP",
        endpoint: `https://firebasestorage.googleapis.com/v0/b/${cachedRef?.bucket || 'N/A'}/o`,
        corsSuspected: isCorsSuspect
      };

      const sdkLayer = {
        firebaseCode: errCode,
        message: err?.message || "N/A",
        serverResponse: err?.serverResponse || null,
        name: err?.name || "N/A"
      };

      const businessLayer = {
        sessionId: sessionUUID,
        uploadId: uid,
        correlationId: uid,
        path: cachedRef?.fullPath || "N/A",
        blobSize: cachedBlob ? `${(cachedBlob.size / 1024).toFixed(2)} KB` : "N/A"
      };

      report.errorLayers = {
        browserLayer,
        httpNetworkLayer,
        sdkLayer,
        businessLayer
      };

      const errorDetails = {
        isFirebaseError,
        name: err?.name || "N/A",
        code: errCode,
        message: err?.message || "N/A",
        customData: err?.customData || "N/A",
        serverResponse: err?.serverResponse || null,
        stack: err?.stack || "N/A",
        pathTried: cachedRef?.fullPath || "N/A",
        bucketTried: cachedRef?.bucket || "N/A"
      };

      report.errorDetails = errorDetails;

      // Automated Root Cause Analysis & Recommendations Engine with Categorized Confidence Level & Rule ID
      const possibleCauses: Array<{
        code: string;
        category: string;
        confidenceLevel: "ALTA" | "MÉDIA" | "BAIXA";
        confidencePercent: string;
        probableReason: string;
        recommendations: string[];
        matchedIndicators: string[];
      }> = [];

      // Rule RC-001: Security Rules Rejection (allow write restrictions)
      if (errCode === 'storage/unauthorized') {
        possibleCauses.push({
          code: "RC-001",
          category: "Regras de Segurança do Storage (Security Rules)",
          confidenceLevel: "ALTA",
          confidencePercent: "98%",
          matchedIndicators: ["STORAGE_UNAUTHORIZED_CODE", "WRITE_DENIED_BY_RULES"],
          probableReason: "O Firebase Storage rejeitou a gravação. O caminho do arquivo não corresponde a uma regra 'allow write' ativa.",
          recommendations: [
            `Verifique o arquivo firestore.rules ou regras de segurança do Storage para o caminho '${errorDetails.pathTried}'.`,
            "Confirme se o formato do caminho de escrita exige autenticação específica e se o usuário atual atende.",
            "Certifique-se de que a regra permite escrita, por exemplo: 'allow write: if request.auth != null;'"
          ]
        });
      }

      // Rule RC-002: Authentication Failure / Missing session
      if (!hasAuth && !isDemoMode) {
        const confidence: "ALTA" | "MÉDIA" = errCode === 'storage/unauthorized' ? "ALTA" : "MÉDIA";
        const percent = errCode === 'storage/unauthorized' ? "90%" : "75%";
        possibleCauses.push({
          code: "RC-002",
          category: "Falha de Autenticação Ativa",
          confidenceLevel: confidence,
          confidencePercent: percent,
          matchedIndicators: ["AUTH_USER_NULL", "MISSING_SESSION_CREDENTIALS"],
          probableReason: "Nenhum usuário autenticado ativo no Firebase Auth detectado durante o upload.",
          recommendations: [
            "Verifique se o usuário passou pelo fluxo de autenticação antes de tentar o upload.",
            "Garanta que a sessão do usuário não expirou ou foi desconectada em segundo plano."
          ]
        });
        report.healthChecks.authenticated = false;
        report.healthChecks.tokenValid = false;
      }

      // Rule RC-003: CORS (Cross-Origin Resource Sharing) Preflight issue
      if (isCorsSuspect) {
        possibleCauses.push({
          code: "RC-003",
          category: "Erro de CORS ou Canal de Rede Bloqueado",
          confidenceLevel: "ALTA",
          confidencePercent: "95%",
          matchedIndicators: ["CORS_PREFLIGHT_FAIL", "HTTP_OPTIONS_BLOCKED"],
          probableReason: "A requisição preflight (OPTIONS) falhou ou o bucket de Storage não possui políticas CORS configuradas para a origem atual.",
          recommendations: [
            "Inspecione a aba 'Network' (Rede) no DevTools e busque pela requisição preflight OPTIONS. Se retornou status HTTP 403, as políticas CORS no bucket precisam ser configuradas.",
            "Adicione cabeçalhos CORS ao seu bucket de Storage usando o utilitário gsutil ou console do GCP.",
            `Confirme se a origem '${typeof window !== 'undefined' ? window.location.origin : '*'}' está liberada nas regras CORS.`
          ]
        });
        report.healthChecks.preflightSucceeded = false;
      }

      // Rule RC-004: Invalid Bucket or Resource not found
      if (errCode === 'storage/object-not-found' || errorDetails.bucketTried === 'N/A' || !report.healthChecks.bucketMatchesExpected) {
        const isMismatch = !report.healthChecks.bucketMatchesExpected;
        possibleCauses.push({
          code: "RC-004",
          category: "Bucket ou Caminho de Destino Inexistente / Divergente",
          confidenceLevel: isMismatch ? "ALTA" : "MÉDIA",
          confidencePercent: isMismatch ? "95%" : "80%",
          matchedIndicators: isMismatch ? ["BUCKET_MISMATCH_WITH_CONFIG"] : ["OBJECT_NOT_FOUND_CODE", "BUCKET_NOT_RESOLVED"],
          probableReason: isMismatch 
            ? `O bucket de destino '${errorDetails.bucketTried}' difere do esperado nas variáveis de ambiente do app: '${report.healthChecks.bucketExpected}'.`
            : "O bucket de armazenamento configurado não existe no projeto ou a referência informada está corrompida.",
          recommendations: [
            `Verifique se o bucket '${errorDetails.bucketTried}' está de fato correto no console do Firebase.`,
            "Assegure-se de que as configurações de storageBucket no objeto de inicialização estão perfeitamente sincronizadas."
          ]
        });
      }

      // Rule RC-005: Offline / Network Instability
      if (!isOnline || errCode === 'storage/retry-limit-exceeded') {
        const level = !isOnline ? "ALTA" : "MÉDIA";
        const percent = !isOnline ? "99%" : "85%";
        possibleCauses.push({
          code: "RC-005",
          category: "Instabilidade de Rede / Conectividade Offline",
          confidenceLevel: level as any,
          confidencePercent: percent,
          matchedIndicators: ["NAVIGATOR_OFFLINE", "RETRY_LIMIT_EXCEEDED"],
          probableReason: "O navegador detectou perda total de conexão à internet ou estourou o limite de retentativas configurado.",
          recommendations: [
            "Verifique se o dispositivo está conectado a uma rede Wi-Fi/dados móveis ativa.",
            "Desative proxies ou VPNs corporativas que possam filtrar conexões aos servidores do Google (googleapis.com)."
          ]
        });
        report.healthChecks.networkOnline = false;
      }

      // Rule RC-006: Timeout / Runtime Limits
      if (errCode === 'storage/retry-limit-exceeded' && isOnline) {
        possibleCauses.push({
          code: "RC-006",
          category: "Limite de Tempo Excedido (Timeout)",
          confidenceLevel: "MÉDIA",
          confidencePercent: "80%",
          matchedIndicators: ["RETRY_LIMIT_WITH_ONLINE_STATE"],
          probableReason: "A conexão TCP ou o envio de dados levou mais tempo do que o máximo permitido.",
          recommendations: [
            "Verifique se o arquivo que está sendo enviado não é excessivamente grande para a taxa de upload atual.",
            "Tente otimizar ou comprimir a imagem no cliente antes de enviá-la."
          ]
        });
      }

      // Fallback: Default cause if nothing matched well
      if (possibleCauses.length === 0) {
        possibleCauses.push({
          code: "RC-007",
          category: "Exceção Genérica do SDK",
          confidenceLevel: "BAIXA",
          confidencePercent: "50%",
          matchedIndicators: ["GENERIC_FIREBASE_EXCEPTION"],
          probableReason: errorDetails.message || "Ocorreu um erro interno sem categorização definida no motor de heurísticas.",
          recommendations: [
            "Verifique a stack trace original exibida no console para obter detalhes adicionais.",
            "Pesquise o código de erro informado nas tabelas oficiais de erros do Firebase Storage."
          ]
        });
      }

      // Sort possible causes by confidence percent numeric parsed value
      possibleCauses.sort((a, b) => parseInt(b.confidencePercent) - parseInt(a.confidencePercent));

      report.possibleCauses = possibleCauses;
      
      // Top match is the primary root cause
      const primary = possibleCauses[0];
      report.rootCauseAnalysis = {
        rootCause: primary.category,
        probableReason: primary.probableReason,
        recommendations: primary.recommendations,
        confidenceLevel: primary.confidenceLevel,
        confidencePercent: primary.confidencePercent,
        code: primary.code
      };

      addTimelineEvent(`Análise de causa raiz gerada automaticamente: ${primary.category} (${primary.code})`);

      console.group(`=== ERRO NO UPLOAD [SESSÃO: ${sessionUUID.substring(0, 8)}] [UPLOAD: ${uid.substring(0, 8)}] ===`);
      console.error(`[ERROR] [${timestamp}] Falha no upload após ${duration.toFixed(2)}ms!`);
      console.log("► Identificação e Trace:", report.trace);
      console.log("► Camadas de Análise (Error Layers):", report.errorLayers);
      console.log("► Análise Detalhada do Erro:", report.errorDetails);
      console.log("► MECANISMO DE CAUSA RAIZ AUTOMÁTICA (RECOMENDAÇÕES):", report.rootCauseAnalysis);
      console.log("► Todas as Causas Possíveis Ranqueadas:", report.possibleCauses);
      console.log("► Validações de Saúde (Health Checks):", report.healthChecks);
      console.log("► Linha do Tempo de Eventos:", report.timeline);
      console.error("► Stack Trace original:", err);
      console.groupEnd();

      // Expose to window helper for developer copying
      if (typeof window !== 'undefined') {
        (window as any).__lastUploadDiagnostic = report;
        const history = (window as any).__uploadDiagnosticsHistory || [];
        history.push(report);
        const MAX_HISTORY = 100;
        while (history.length > MAX_HISTORY) {
          history.shift();
        }
        (window as any).__uploadDiagnosticsHistory = history;
      }
    },

    getReport: () => {
      return report;
    },
    setPhase: (phase: "prepare" | "auth" | "createReference" | "uploadStarted" | "uploadFinished" | "downloadUrl") => {
      report.uploadPhase = phase;
      addTimelineEvent(`Fase do upload alterada manualmente para: ${phase}`);
    }
  };
}

/**
 * Executes an automated test suite over the diagnostic heuristics engine to verify correctness.
 * Simulates different error scenarios and validates categorization, confidence matching, and recommendations.
 */
export function testDiagnosticEngine(): any {
  console.group("🧪 [SUITE DE TESTE] Root Cause Diagnostic Heuristics Engine");
  
  const testCases = [
    {
      name: "Teste 1: Regras do Storage Bloqueadas",
      error: { name: "FirebaseError", code: "storage/unauthorized", message: "User is not authorized." },
      expectedCode: "RC-001"
    },
    {
      name: "Teste 2: Dispositivo Sem Conectividade (Timeout)",
      error: { name: "FirebaseError", code: "storage/retry-limit-exceeded", message: "Network connection lost." },
      expectedCode: "RC-005"
    },
    {
      name: "Teste 3: Objeto ou Bucket Inexistente",
      error: { name: "FirebaseError", code: "storage/object-not-found", message: "No bucket found." },
      expectedCode: "RC-004"
    },
    {
      name: "Teste 4: Possível Bloqueio CORS",
      error: { name: "FirebaseError", code: "storage/unknown", message: "CORS preflight channel closed." },
      expectedCode: "RC-003"
    }
  ];

  const results = testCases.map(tc => {
    const diagnostics = createUploadDiagnostics();
    // Simulate error scenario
    diagnostics.error(tc.error);
    const rep = diagnostics.getReport();
    const primaryCode = rep.rootCauseAnalysis?.code;
    const passed = primaryCode === tc.expectedCode;
    console.log(`${passed ? "✅" : "❌"} ${tc.name}: Código esperado ${tc.expectedCode}, obtido ${primaryCode} (Nível: ${rep.rootCauseAnalysis?.confidenceLevel} / ${rep.rootCauseAnalysis?.confidencePercent})`);
    return { name: tc.name, passed, expected: tc.expectedCode, actual: primaryCode };
  });

  const allPassed = results.every(r => r.passed);
  console.log(`\nResultado da execução: ${allPassed ? "SUCESSO ABSOLUTO" : "ALERTA DE REVERSSÃO"}`);
  console.groupEnd();

  return { allPassed, results };
}

// Listen and log the active real Firebase user state changes
if (typeof window !== 'undefined' && !isDemoMode) {
  try {
    realOnAuthStateChanged(auth, (user) => {
      if (debugFirebase) {
        console.log("=== DIAGNOSTICO AUTH FIREBASE ===");
        if (user) {
          console.log("Usuário autenticado:", {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified
          });
          // Update the sanitized window diagnostic object with safe info
          if ((window as any).__firebaseDebug) {
            (window as any).__firebaseDebug.currentUser = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName
            };
          }
        } else {
          console.log("Nenhum usuário autenticado no Firebase Auth.");
          if ((window as any).__firebaseDebug) {
            (window as any).__firebaseDebug.currentUser = null;
          }
        }
      }
    });
  } catch (err) {
    console.error("Erro ao registrar logger de autenticação:", err);
  }
}

// Expose a unified global utility to copy/export the full layered diagnostic report instantly
if (typeof window !== 'undefined') {
  (window as any).exportLastUploadReport = () => {
    const report = (window as any).__lastUploadDiagnostic;
    if (!report) {
      console.warn("Nenhum diagnóstico de upload disponível ainda. Faça um upload para gerar.");
      return null;
    }
    return report;
  };
  (window as any).exportLastUploadReportJson = () => {
    const report = (window as any).__lastUploadDiagnostic;
    if (!report) {
      console.warn("Nenhum diagnóstico de upload disponível ainda.");
      return "{}";
    }
    return JSON.stringify(report, null, 2);
  };
}

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
  ref?: any;
  previousDocsMap: Map<string, string>;
}>();

function buildSnapshotForListener(listener: any) {
  if (listener.isDoc) {
    const parts = listener.path.split('/');
    const id = parts[parts.length - 1];
    const collectionPath = parts.slice(0, parts.length - 1).join('/');
    const coll = getLocalCollection(collectionPath);
    const data = coll[id];
    return {
      exists: () => data !== undefined,
      id,
      data: () => data
    };
  } else {
    const pathValue = listener.path || '';
    const coll = getLocalCollection(pathValue);
    let docs = Object.entries(coll).map(([id, val]) => ({
      id,
      data: () => val,
      exists: () => true
    }));

    // Apply ref/query filters if ref has filters
    const ref = listener.ref;
    if (ref && ref.filters && ref.filters.length > 0) {
      docs = docs.filter((docSnap: any) => {
        const docData = docSnap.data();
        if (!docData) return false;
        for (const filter of ref.filters) {
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

    if (ref && ref.orders && ref.orders.length > 0) {
      ref.orders.forEach((order: any) => {
        docs.sort((a, b) => {
          const valA = a.data()?.[order.field];
          const valB = b.data()?.[order.field];
          if (valA === undefined) return 1;
          if (valB === undefined) return -1;
          if (valA < valB) return order.dir === 'desc' ? 1 : -1;
          if (valA > valB) return order.dir === 'desc' ? -1 : 1;
          return 0;
        });
      });
    }

    if (ref && ref.limitVal !== null && ref.limitVal !== undefined) {
      docs = docs.slice(0, ref.limitVal);
    }

    // Calculate changes
    const changes: any[] = [];
    const currentDocsMap = new Map<string, string>();

    docs.forEach(docSnap => {
      const docId = docSnap.id;
      const docJson = JSON.stringify(docSnap.data());
      currentDocsMap.set(docId, docJson);

      if (!listener.previousDocsMap.has(docId)) {
        changes.push({ type: 'added', doc: docSnap });
      } else if (listener.previousDocsMap.get(docId) !== docJson) {
        changes.push({ type: 'modified', doc: docSnap });
      }
    });

    listener.previousDocsMap.forEach((oldJson: string, oldId: string) => {
      if (!currentDocsMap.has(oldId)) {
        changes.push({
          type: 'removed',
          doc: {
            id: oldId,
            data: () => JSON.parse(oldJson),
            exists: () => false
          }
        });
      }
    });

    // Update the map for the next run
    listener.previousDocsMap = currentDocsMap;

    return {
      empty: docs.length === 0,
      docs,
      forEach: (cb: (doc: any) => void) => {
        docs.forEach(cb);
      },
      docChanges: () => changes
    };
  }
}

function triggerSnapshotListeners(path: string) {
  snapshotListeners.forEach(listener => {
    const listenerBaseColl = listener.path.split('/')[0];
    const triggerBaseColl = path.split('/')[0];
    if (listenerBaseColl === triggerBaseColl) {
      const snapshot = buildSnapshotForListener(listener);
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

export const sendPasswordResetEmail = isDemoMode ? async (authInstance: any, email: string) => {
  toast.success(`E-mail de redefinição enviado para ${email} (Modo Simulação)`);
} : (authInstance: any, email: string) => realSendPasswordResetEmail(authInstance, email);

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
  const isPlainOffline = !isDemoMode && !navigator.onLine;
  if (isPlainOffline) {
    toast.error("Sem conexão — a alteração será perdida ao recarregar a página. Verifique sua internet e tente novamente.");
    throw new Error("offline");
  }

  try {
    const parts = docRef.path?.split('/');
    if (parts && parts.length >= 2) {
      const id = parts[parts.length - 1];
      const collectionPath = parts.slice(0, parts.length - 1).join('/');
      const coll = getLocalCollection(collectionPath);
      const existing = coll[id] || {};
      const updated = options?.merge ? { ...existing, ...sanitized } : sanitized;
      coll[id] = updated;
      setLocalCollection(collectionPath, coll);
    }
  } catch (e) {
    console.warn("Local storage write update failed:", e);
  }

  if (isDemoMode) {
    return;
  }

  try {
    return await realSetDoc(docRef, sanitized, options);
  } catch (error: any) {
    const errorMsg = error?.message?.toLowerCase() || '';
    if (errorMsg.includes("client is offline") || errorMsg.includes("offline") || errorMsg.includes("network")) {
      toast.error("Sem conexão — a alteração será perdida ao recarregar a página. Verifique sua internet e tente novamente.");
      throw new Error("offline");
    }
    throw error;
  }
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
  try {
    const result = await realGetDoc(docRef);
    try {
      if (result && result.exists()) {
        const parts = docRef.path?.split('/');
        if (parts && parts.length >= 2) {
          const id = parts[parts.length - 1];
          const collectionPath = parts.slice(0, parts.length - 1).join('/');
          const coll = getLocalCollection(collectionPath);
          coll[id] = result.data();
          setLocalCollection(collectionPath, coll);
        }
      }
    } catch (cacheErr) {
      console.warn("Error caching doc in real mode:", cacheErr);
    }
    return result;
  } catch (error: any) {
    if (error?.message?.includes("client is offline") || error?.message?.includes("offline")) {
      console.warn("Firestore offline: sliding into fallback local cache for getDoc", docRef.path);
      const parts = docRef.path?.split('/');
      if (parts && parts.length >= 2) {
        const id = parts[parts.length - 1];
        const collectionPath = parts.slice(0, parts.length - 1).join('/');
        const coll = getLocalCollection(collectionPath);
        const data = coll[id];
        if (data !== undefined) {
          return {
            exists: () => true,
            id,
            data: () => data
          };
        }
      }
      return {
        exists: () => false,
        id: docRef.id || "",
        data: () => null
      };
    }
    throw error;
  }
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
  try {
    const result = await realGetDocs(queryRef);
    try {
      const path = queryRef.path || (queryRef.collectionRef ? queryRef.collectionRef.path : '');
      if (path && result?.docs) {
        const coll = getLocalCollection(path);
        result.docs.forEach((docSnap: any) => {
          if (docSnap && docSnap.exists()) {
            coll[docSnap.id] = docSnap.data();
          }
        });
        setLocalCollection(path, coll);
      }
    } catch (cacheErr) {
      console.warn("Error caching docs in real mode:", cacheErr);
    }
    return result;
  } catch (error: any) {
    if (error?.message?.includes("client is offline") || error?.message?.includes("offline")) {
      console.warn("Firestore offline: sliding into fallback local cache for getDocs", queryRef);
      const path = queryRef.path || (queryRef.collectionRef ? queryRef.collectionRef.path : (typeof queryRef === 'string' ? queryRef : ''));
      if (path) {
        const coll = getLocalCollection(path);
        let docs = Object.entries(coll).map(([id, val]) => ({
          id,
          data: () => val,
          exists: () => true
        }));

        if (queryRef && queryRef.filters && queryRef.filters.length > 0) {
          docs = docs.filter(docSnap => {
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
          empty: docs.length === 0,
          docs,
          forEach: (callback: (doc: any) => void) => {
            docs.forEach(callback);
          }
        };
      }
      return {
        empty: true,
        docs: [],
        forEach: () => {}
      };
    }
    throw error;
  }
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
    const listener = { path, isDoc, callback, ref, previousDocsMap: new Map<string, string>() };
    snapshotListeners.add(listener);

    const initialSnapshot = buildSnapshotForListener(listener);
    
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
  const isPlainOffline = !isDemoMode && !navigator.onLine;
  if (isPlainOffline) {
    toast.error("Sem conexão — a alteração será perdida ao recarregar a página. Verifique sua internet e tente novamente.");
    throw new Error("offline");
  }

  if (isDemoMode) {
    const id = "doc_" + Math.random().toString(36).substring(2, 9);
    const coll = getLocalCollection(collectionRef.path);
    const enriched = { ...sanitized, id };
    coll[id] = enriched;
    setLocalCollection(collectionRef.path, coll);
    return { id, path: `${collectionRef.path}/${id}` };
  }

  try {
    const result = await realAddDoc(collectionRef, sanitized);
    try {
      if (result && result.id) {
        const coll = getLocalCollection(collectionRef.path);
        coll[result.id] = { ...sanitized, id: result.id };
        setLocalCollection(collectionRef.path, coll);
      }
    } catch (e) {}
    return result;
  } catch (error: any) {
    const errorMsg = error?.message?.toLowerCase() || '';
    if (errorMsg.includes("client is offline") || errorMsg.includes("offline") || errorMsg.includes("network")) {
      toast.error("Sem conexão — a alteração será perdida ao recarregar a página. Verifique sua internet e tente novamente.");
      throw new Error("offline");
    }
    throw error;
  }
}

export async function updateDoc(docRef: any, data: any) {
  const sanitized = sanitizeForFirestore(data);
  const isPlainOffline = !isDemoMode && !navigator.onLine;
  if (isPlainOffline) {
    toast.error("Sem conexão — a alteração será perdida ao recarregar a página. Verifique sua internet e tente novamente.");
    throw new Error("offline");
  }

  try {
    const parts = docRef.path?.split('/');
    if (parts && parts.length >= 2) {
      const id = parts[parts.length - 1];
      const collectionPath = parts.slice(0, parts.length - 1).join('/');
      const coll = getLocalCollection(collectionPath);
      const existing = coll[id] || {};
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
      coll[id] = updated;
      setLocalCollection(collectionPath, coll);
    }
  } catch (e) {}

  if (isDemoMode) {
    return;
  }

  try {
    return await realUpdateDoc(docRef, sanitized);
  } catch (error: any) {
    const errorMsg = error?.message?.toLowerCase() || '';
    if (errorMsg.includes("client is offline") || errorMsg.includes("offline") || errorMsg.includes("network")) {
      toast.error("Sem conexão — a alteração será perdida ao recarregar a página. Verifique sua internet e tente novamente.");
      throw new Error("offline");
    }
    throw error;
  }
}

export async function deleteDoc(docRef: any) {
  const isPlainOffline = !isDemoMode && !navigator.onLine;
  if (isPlainOffline) {
    toast.error("Sem conexão — a alteração será perdida ao recarregar a página. Verifique sua internet e tente novamente.");
    throw new Error("offline");
  }

  try {
    const parts = docRef.path?.split('/');
    if (parts && parts.length >= 2) {
      const id = parts[parts.length - 1];
      const collectionPath = parts.slice(0, parts.length - 1).join('/');
      const coll = getLocalCollection(collectionPath);
      delete coll[id];
      setLocalCollection(collectionPath, coll);
    }
  } catch (e) {}

  if (isDemoMode) {
    return;
  }

  try {
    return await realDeleteDoc(docRef);
  } catch (error: any) {
    const errorMsg = error?.message?.toLowerCase() || '';
    if (errorMsg.includes("client is offline") || errorMsg.includes("offline") || errorMsg.includes("network")) {
      toast.error("Sem conexão — a alteração será perdida ao recarregar a página. Verifique sua internet e tente novamente.");
      throw new Error("offline");
    }
    throw error;
  }
}

export function writeBatch(dbInstance: any) {
  if (isDemoMode) {
    const operations: Array<() => Promise<void>> = [];
    const batchObj = {
      set: (docRef: any, data: any, options?: any) => {
        operations.push(async () => {
          await setDoc(docRef, data, options);
        });
        return batchObj;
      },
      update: (docRef: any, data: any) => {
        operations.push(async () => {
          await updateDoc(docRef, data);
        });
        return batchObj;
      },
      delete: (docRef: any) => {
        operations.push(async () => {
          await deleteDoc(docRef);
        });
        return batchObj;
      },
      commit: async () => {
        for (const op of operations) {
          await op();
        }
      }
    };
    return batchObj as any;
  }
  return realWriteBatch(dbInstance);
}

export async function runTransaction(dbInstance: any, updateFunction: (transaction: any) => Promise<any>) {
  if (isDemoMode) {
    const transaction = {
      get: async (docRef: any) => {
        const parts = docRef.path?.split('/');
        if (parts && parts.length >= 2) {
          const id = parts[parts.length - 1];
          const collectionPath = parts.slice(0, parts.length - 1).join('/');
          const coll = getLocalCollection(collectionPath);
          const data = coll[id];
          return {
            exists: () => data !== undefined,
            id,
            data: () => data
          };
        }
        return {
          exists: () => false,
          id: docRef.id || "",
          data: () => null
        };
      },
      update: (docRef: any, data: any) => {
        const parts = docRef.path?.split('/');
        if (parts && parts.length >= 2) {
          const id = parts[parts.length - 1];
          const collectionPath = parts.slice(0, parts.length - 1).join('/');
          const coll = getLocalCollection(collectionPath);
          const existing = coll[id] || {};
          coll[id] = { ...existing, ...data };
          setLocalCollection(collectionPath, coll);
        }
        return transaction;
      },
      set: (docRef: any, data: any, options?: any) => {
        const parts = docRef.path?.split('/');
        if (parts && parts.length >= 2) {
          const id = parts[parts.length - 1];
          const collectionPath = parts.slice(0, parts.length - 1).join('/');
          const coll = getLocalCollection(collectionPath);
          const existing = coll[id] || {};
          const sanitized = sanitizeForFirestore(data);
          coll[id] = options?.merge ? { ...existing, ...sanitized } : sanitized;
          setLocalCollection(collectionPath, coll);
        }
        return transaction;
      },
      delete: (docRef: any) => {
        const parts = docRef.path?.split('/');
        if (parts && parts.length >= 2) {
          const id = parts[parts.length - 1];
          const collectionPath = parts.slice(0, parts.length - 1).join('/');
          const coll = getLocalCollection(collectionPath);
          delete coll[id];
          setLocalCollection(collectionPath, coll);
        }
        return transaction;
      }
    };
    return await updateFunction(transaction);
  }

  return await realRunTransaction(dbInstance, updateFunction);
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
  static now(): any {
    if (!isDemoMode) {
      return realTimestamp.now();
    }
    const d = new Date();
    return new Timestamp(Math.floor(d.getTime() / 1000), 0);
  }
  static fromDate(date: Date): any {
    if (!isDemoMode) {
      return realTimestamp.fromDate(date);
    }
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
