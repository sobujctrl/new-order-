import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { initializeFirebaseInstances } from '../firebase/config';

export interface FacebookRawAccount {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  tasks?: string[];
}

export interface ConnectedFacebookPage {
  pageId: string;
  name: string;
  token: string;
  connectedAt: string;
  category?: string;
  subscribed?: boolean;
}

export interface PageOwnerDoc {
  uid: string;
  pageId: string;
  name: string;
  connectedAt: string;
}

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

const FB_CUSTOM_APP_ID_KEY = 'user_fb_custom_app_id_v1';

export function getFacebookAppId(): string {
  const envAppId = import.meta.env.VITE_FB_APP_ID;
  if (envAppId && envAppId.trim()) {
    return envAppId.trim();
  }
  try {
    const stored = localStorage.getItem(FB_CUSTOM_APP_ID_KEY);
    if (stored && stored.trim()) return stored.trim();
  } catch (e) {
    console.error(e);
  }
  return '';
}

export function saveFacebookAppId(appId: string): void {
  try {
    localStorage.setItem(FB_CUSTOM_APP_ID_KEY, appId.trim());
    window.dispatchEvent(new CustomEvent('fb_app_id_updated'));
  } catch (e) {
    console.error(e);
  }
}

let isSdkInitialized = false;
let sdkInitPromise: Promise<boolean> | null = null;

/**
 * Initializes Facebook JavaScript SDK asynchronously
 */
export function initFacebookSdk(appId?: string): Promise<boolean> {
  const effectiveAppId = appId || getFacebookAppId();
  if (!effectiveAppId) {
    return Promise.resolve(false);
  }

  if (isSdkInitialized && window.FB) {
    return Promise.resolve(true);
  }

  if (sdkInitPromise) {
    return sdkInitPromise;
  }

  sdkInitPromise = new Promise((resolve) => {
    // If FB already defined on window
    if (window.FB) {
      window.FB.init({
        appId: effectiveAppId,
        cookie: true,
        xfbml: true,
        version: 'v21.0',
      });
      isSdkInitialized = true;
      resolve(true);
      return;
    }

    // Set fbAsyncInit callback
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: effectiveAppId,
        cookie: true,
        xfbml: true,
        version: 'v21.0',
      });
      isSdkInitialized = true;
      resolve(true);
    };

    // Load SDK script tag
    const scriptId = 'facebook-jssdk';
    if (!document.getElementById(scriptId)) {
      const js = document.createElement('script');
      js.id = scriptId;
      js.src = 'https://connect.facebook.net/en_US/sdk.js';
      js.async = true;
      js.defer = true;
      js.onerror = () => {
        console.error('Facebook SDK script load failed.');
        resolve(false);
      };
      document.body.appendChild(js);
    }
  });

  return sdkInitPromise;
}

/**
 * Trigger Facebook Login Popup with required permissions for Page management & messaging
 */
export async function loginWithFacebook(): Promise<{
  success: boolean;
  accessToken?: string;
  error?: string;
}> {
  const appId = getFacebookAppId();
  if (!appId) {
    return {
      success: false,
      error: 'Facebook App ID কনফিগার করা নেই। অনুগ্রহ করে প্রথমে App ID প্রদান করুন।',
    };
  }

  const initialized = await initFacebookSdk(appId);
  if (!initialized || !window.FB) {
    return {
      success: false,
      error: 'Facebook JavaScript SDK লোড করতে সমস্যা হয়েছে। ইন্টারনেট সংযোগ পরীক্ষা করুন।',
    };
  }

  return new Promise((resolve) => {
    try {
      window.FB.login(
        (response: any) => {
          if (response?.authResponse) {
            resolve({
              success: true,
              accessToken: response.authResponse.accessToken,
            });
          } else if (response?.status === 'not_authorized') {
            resolve({
              success: false,
              error: 'অ্যাপটিতে প্রয়োজনীয় পারমিশন অনুমোদন করা হয়নি।',
            });
          } else {
            resolve({
              success: false,
              error: 'Facebook লগইন উইন্ডোটি বাতিল করা হয়েছে অথবা পপআপ ব্লক করা হয়েছে।',
            });
          }
        },
        {
          scope: 'pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement',
          return_scopes: true,
        }
      );
    } catch (err: any) {
      console.error('FB.login error:', err);
      resolve({
        success: false,
        error: `Facebook লগইনে সমস্যা: ${err?.message || String(err)}`,
      });
    }
  });
}

/**
 * Fetch all pages managed by the logged-in user (/me/accounts)
 */
export async function fetchUserFacebookPages(): Promise<{
  success: boolean;
  pages: FacebookRawAccount[];
  error?: string;
}> {
  if (!window.FB) {
    return { success: false, pages: [], error: 'Facebook SDK সক্রিয় নেই।' };
  }

  return new Promise((resolve) => {
    window.FB.api(
      '/me/accounts',
      { fields: 'id,name,access_token,category,tasks' },
      (response: any) => {
        if (!response || response.error) {
          console.error('FB.api /me/accounts error:', response?.error);
          resolve({
            success: false,
            pages: [],
            error: response?.error?.message || 'Facebook পেজ তালিকা আনতে সমস্যা হয়েছে।',
          });
          return;
        }

        const data: FacebookRawAccount[] = (response.data || []).map((item: any) => ({
          id: String(item.id),
          name: String(item.name || `Page ${item.id}`),
          access_token: String(item.access_token || ''),
          category: item.category ? String(item.category) : undefined,
          tasks: Array.isArray(item.tasks) ? item.tasks : [],
        }));

        resolve({ success: true, pages: data });
      }
    );
  });
}

/**
 * Subscribes Page to app webhooks (messages, feed)
 * POST /{pageId}/subscribed_apps?subscribed_fields=messages,feed
 */
export async function subscribePageWebhooks(
  pageId: string,
  pageToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?subscribed_fields=messages,feed&access_token=${encodeURIComponent(
      pageToken
    )}`;
    const res = await fetch(url, { method: 'POST' });
    const json = await res.json();
    if (json.success === true || json.data) {
      return { success: true };
    }
    return {
      success: false,
      error: json?.error?.message || 'Webhooks সাবস্ক্রিপশন ব্যর্থ হয়েছে।',
    };
  } catch (e: any) {
    console.error('Error subscribing page webhooks:', e);
    return {
      success: false,
      error: e?.message || 'Webhooks সাবস্ক্রিপশন কল করতে নেটওয়ার্ক সমস্যা হয়েছে।',
    };
  }
}

/**
 * Unsubscribes Page from app webhooks
 * DELETE /{pageId}/subscribed_apps
 */
export async function unsubscribePageWebhooks(
  pageId: string,
  pageToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?access_token=${encodeURIComponent(
      pageToken
    )}`;
    const res = await fetch(url, { method: 'DELETE' });
    const json = await res.json();
    if (json.success === true) {
      return { success: true };
    }
    return {
      success: false,
      error: json?.error?.message || 'Unsubscribe কল ব্যর্থ হয়েছে।',
    };
  } catch (e: any) {
    console.error('Error unsubscribing page webhooks:', e);
    return { success: false, error: e?.message || 'নেটওয়ার্ক ত্রুটি।' };
  }
}

/**
 * Connects selected Facebook pages:
 * 1. Saves to users/{uid}/pages/{pageId}
 * 2. Saves to pageOwners/{pageId}
 * 3. Calls POST /{pageId}/subscribed_apps?subscribed_fields=messages,feed
 */
export async function connectFacebookPages(
  uid: string,
  pagesToConnect: FacebookRawAccount[]
): Promise<{
  success: boolean;
  connectedCount: number;
  errors: string[];
}> {
  const { db } = initializeFirebaseInstances();
  if (!db || !uid) {
    return {
      success: false,
      connectedCount: 0,
      errors: ['Firestore বা ইউজার সেশন সক্রিয় নেই। অনুগ্রহ করে লগইন নিশ্চিত করুন।'],
    };
  }

  let connectedCount = 0;
  const errors: string[] = [];
  const nowIso = new Date().toISOString();

  for (const page of pagesToConnect) {
    try {
      // 1. Subscribe webhooks first
      let webhookSubscribed = false;
      if (page.access_token) {
        const subResult = await subscribePageWebhooks(page.id, page.access_token);
        webhookSubscribed = subResult.success;
        if (!subResult.success) {
          console.warn(`Webhook subscription notice for page ${page.name}:`, subResult.error);
        }
      }

      // 2. Save users/{uid}/pages/{pageId}
      const pageDocRef = doc(db, 'users', uid, 'pages', page.id);
      const pageData: ConnectedFacebookPage = {
        pageId: page.id,
        name: page.name,
        token: page.access_token,
        connectedAt: nowIso,
        category: page.category || 'Business',
        subscribed: webhookSubscribed,
      };
      await setDoc(pageDocRef, pageData, { merge: true });

      // 3. Save root pageOwners/{pageId}
      const ownerDocRef = doc(db, 'pageOwners', page.id);
      const ownerData: PageOwnerDoc = {
        uid,
        pageId: page.id,
        name: page.name,
        connectedAt: nowIso,
      };
      await setDoc(ownerDocRef, ownerData, { merge: true });

      connectedCount++;
    } catch (err: any) {
      console.error(`Error connecting page ${page.name}:`, err);
      errors.push(`"${page.name}" কানেক্ট করতে ব্যর্থ: ${err?.message || String(err)}`);
    }
  }

  return {
    success: connectedCount > 0,
    connectedCount,
    errors,
  };
}

/**
 * Disconnects a Facebook Page:
 * 1. Calls DELETE /{pageId}/subscribed_apps
 * 2. Deletes users/{uid}/pages/{pageId}
 * 3. Deletes pageOwners/{pageId}
 */
export async function disconnectFacebookPage(
  uid: string,
  page: ConnectedFacebookPage
): Promise<{ success: boolean; error?: string }> {
  const { db } = initializeFirebaseInstances();
  if (!db || !uid) {
    return { success: false, error: 'ডাটাবেজ বা ইউজার সেশন সক্রিয় নেই।' };
  }

  try {
    // 1. Attempt webhook unsubscribe if token is present
    if (page.token) {
      await unsubscribePageWebhooks(page.pageId, page.token).catch((err) =>
        console.warn('Unsubscribe warning:', err)
      );
    }

    // 2. Delete users/{uid}/pages/{pageId}
    await deleteDoc(doc(db, 'users', uid, 'pages', page.pageId));

    // 3. Delete pageOwners/{pageId}
    await deleteDoc(doc(db, 'pageOwners', page.pageId));

    return { success: true };
  } catch (err: any) {
    console.error('Error disconnecting page:', err);
    return {
      success: false,
      error: `পেজ ডিসকানেক্ট করতে সমস্যা: ${err?.message || String(err)}`,
    };
  }
}

/**
 * Real-time listener for connected pages of the user: users/{uid}/pages
 */
export function subscribeConnectedPages(
  uid: string,
  onUpdate: (pages: ConnectedFacebookPage[]) => void,
  onError?: (err: any) => void
): () => void {
  const { db } = initializeFirebaseInstances();
  if (!db || !uid) {
    onUpdate([]);
    return () => {};
  }

  try {
    const pagesCol = collection(db, 'users', uid, 'pages');
    const unsubscribe = onSnapshot(
      pagesCol,
      (snapshot) => {
        const list: ConnectedFacebookPage[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as any;
          list.push({
            pageId: docSnap.id,
            name: String(d.name || `Page ${docSnap.id}`),
            token: String(d.token || ''),
            connectedAt: String(d.connectedAt || new Date().toISOString()),
            category: d.category ? String(d.category) : undefined,
            subscribed: Boolean(d.subscribed),
          });
        });
        // Sort newest connected first
        list.sort(
          (a, b) =>
            new Date(b.connectedAt).getTime() - new Date(a.connectedAt).getTime()
        );
        onUpdate(list);
      },
      (error) => {
        console.error('Error subscribing to connected pages:', error);
        onError?.(error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('Error in subscribeConnectedPages:', err);
    onError?.(err);
    return () => {};
  }
}
