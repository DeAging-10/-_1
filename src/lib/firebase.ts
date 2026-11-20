import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { OperationType, type FirestoreErrorInfo } from '../types/facility';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'bhkang1030@gmail.com';
export const INTERNAL_LOGIN_DOMAIN = 'office-manager.internal';
export const FIREBASE_CONSOLE_AUTH_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Secondary Firebase Auth instance so a facility manager can create
 * employee ID/password accounts without terminating their own admin session.
 */
export function getSecondaryAuth(): Auth {
  const existingApp = getApps().find((a: FirebaseApp) => a.name === 'AdminAccountProvisioner');
  const secondaryApp = existingApp ?? initializeApp(firebaseConfig, 'AdminAccountProvisioner');
  return getAuth(secondaryApp);
}

/**
 * Converts an employee login_id (e.g. "kim.minsu") into an internal Auth email
 * if the login_id is not already formatted as an email address.
 */
export function loginIdToAuthEmail(loginId: string): string {
  const trimmed = loginId.trim().toLowerCase();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${trimmed}@${INTERNAL_LOGIN_DOMAIN}`;
}

/**
 * Matches Firestore Security Rule helper:
 * request.auth.token.email.lower().replace('[^a-z0-9]', '_')
 */
export function emailToInviteId(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
