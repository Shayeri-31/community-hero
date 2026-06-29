import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyAWQmbd5zu4hb2yYfpnxhyhXEVzqQY7LtQ",
  authDomain: "noble-infinity-nbndl.firebaseapp.com",
  projectId: "noble-infinity-nbndl",
  storageBucket: "noble-infinity-nbndl.firebasestorage.app",
  messagingSenderId: "384112070820",
  appId: "1:384112070820:web:79847ad4b543c2db3f1631",
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific database ID
export const db = getFirestore(app, "ai-studio-886effb9-3f6e-4d5c-82f0-d53775559751");

// Initialize Firebase Storage
export const storage = getStorage(app);

// Initialize Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
}
