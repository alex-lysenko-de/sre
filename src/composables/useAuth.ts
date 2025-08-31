// composables/useAuth.ts
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';

interface User {
  id: string;
  displayName: string;
  role: 'user' | 'admin';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// Утилиты для работы с base64url
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Secure Storage для токенов
class SecureStorage {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';

  async saveToken(token: string): Promise<void> {
    try {
      // В production используй Capacitor SecureStorage или Keychain
      if ('SecureStorage' in window) {
        // @ts-ignore
        await window.SecureStorage.set(this.TOKEN_KEY, token);
      } else {
        // Fallback: localStorage (только для development)
        localStorage.setItem(this.TOKEN_KEY, token);
      }
    } catch (error) {
      console.error('Failed to save token:', error);
    }
  }

  async getToken(): Promise<string | null> {
    try {
      if ('SecureStorage' in window) {
        // @ts-ignore
        return await window.SecureStorage.get(this.TOKEN_KEY);
      } else {
        return localStorage.getItem(this.TOKEN_KEY);
      }
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  async saveUser(user: User): Promise<void> {
    try {
      if ('SecureStorage' in window) {
        // @ts-ignore
        await window.SecureStorage.set(this.USER_KEY, JSON.stringify(user));
      } else {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  }

  async getUser(): Promise<User | null> {
    try {
      let userData: string | null;
      if ('SecureStorage' in window) {
        // @ts-ignore
        userData = await window.SecureStorage.get(this.USER_KEY);
      } else {
        userData = localStorage.getItem(this.USER_KEY);
      }
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      if ('SecureStorage' in window) {
        // @ts-ignore
        await window.SecureStorage.remove(this.TOKEN_KEY);
        // @ts-ignore
        await window.SecureStorage.remove(this.USER_KEY);
      } else {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
      }
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }
}

const storage = new SecureStorage();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://your-project.supabase.co/functions/v1/auth';

// Глобальное состояние
const user = ref<User | null>(null);
const token = ref<string | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

export function useAuth() {
  const router = useRouter();

  const isAuthenticated = computed(() => !!token.value && !!user.value);

  // Инициализация (загрузка из storage)
  async function initialize() {
    isLoading.value = true;
    try {
      const savedToken = await storage.getToken();
      const savedUser = await storage.getUser();

      if (savedToken && savedUser) {
        token.value = savedToken;
        user.value = savedUser;
      }
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      isLoading.value = false;
    }
  }

  // Регистрация - шаг 1: подготовка
  async function registerPrepare(inviteToken: string, displayName: string) {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${API_BASE_URL}/register/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteToken, displayName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to prepare registration');
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  // Регистрация - шаг 2: WebAuthn create + finish
  async function register(inviteToken: string, displayName: string) {
    try {
      // Проверка поддержки WebAuthn
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn is not supported on this device');
      }

      // Шаг 1: получить challenge
      const prepareData = await registerPrepare(inviteToken, displayName);

      // Конвертируем challenge в ArrayBuffer
      const publicKeyOptions = {
        ...prepareData.publicKey,
        challenge: base64urlToBuffer(prepareData.publicKey.challenge),
        user: {
          ...prepareData.publicKey.user,
          id: base64urlToBuffer(prepareData.publicKey.user.id),
        },
      };

      // Шаг 2: создать credential через WebAuthn
      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      // Подготовить данные для отправки
      const attestationResponse = credential.response as AuthenticatorAttestationResponse;
      const attestation = {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        response: {
          clientDataJSON: bufferToBase64url(attestationResponse.clientDataJSON),
          attestationObject: bufferToBase64url(attestationResponse.attestationObject),
        },
        type: credential.type,
      };

      // Шаг 3: завершить регистрацию на сервере
      const finishResponse = await fetch(`${API_BASE_URL}/register/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: prepareData.challengeId,
          attestation,
          displayName,
        }),
      });

      if (!finishResponse.ok) {
        const errorData = await finishResponse.json();
        throw new Error(errorData.error || 'Registration failed');
      }

      const result = await finishResponse.json();

      // Сохранить токен и пользователя
      token.value = result.token;
      user.value = result.user;
      await storage.saveToken(result.token);
      await storage.saveUser(result.user);

      return result;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  }

  // Вход - шаг 1: подготовка
  async function loginPrepare(userId?: string) {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${API_BASE_URL}/login/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to prepare login');
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  // Вход - шаг 2: WebAuthn get + finish
  async function login(userId?: string) {
    try {
      // Проверка поддержки WebAuthn
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn is not supported on this device');
      }

      // Шаг 1: получить challenge
      const prepareData = await loginPrepare(userId);

      // Конвертируем challenge в ArrayBuffer
      const publicKeyOptions: any = {
        ...prepareData.publicKey,
        challenge: base64urlToBuffer(prepareData.publicKey.challenge),
      };

      // Если есть allowCredentials, конвертируем их
      if (publicKeyOptions.allowCredentials) {
        publicKeyOptions.allowCredentials = publicKeyOptions.allowCredentials.map(
          (cred: any) => ({
            ...cred,
            id: base64urlToBuffer(cred.id),
          })
        );
      }

      // Шаг 2: получить assertion через WebAuthn
      const credential = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to get credential');
      }

      // Подготовить данные для отправки
      const assertionResponse = credential.response as AuthenticatorAssertionResponse;
      const assertion = {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        response: {
          clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
          authenticatorData: bufferToBase64url(assertionResponse.authenticatorData),
          signature: bufferToBase64url(assertionResponse.signature),
          userHandle: assertionResponse.userHandle
            ? bufferToBase64url(assertionResponse.userHandle)
            : undefined,
        },
        type: credential.type,
      };

      // Шаг 3: завершить вход на сервере
      const finishResponse = await fetch(`${API_BASE_URL}/login/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: prepareData.challengeId,
          assertion,
        }),
      });

      if (!finishResponse.ok) {
        const errorData = await finishResponse.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const result = await finishResponse.json();

      // Сохранить токен и пользователя
      token.value = result.token;
      user.value = result.user;
      await storage.saveToken(result.token);
      await storage.saveUser(result.user);

      return result;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  }

  // Выход
  async function logout() {
    token.value = null;
    user.value = null;
    await storage.clear();
    router.push('/login');
  }

  // Проверка роли
  function isAdmin(): boolean {
    return user.value?.role === 'admin';
  }

  // API запрос с токеном
  async function apiRequest(endpoint: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    if (token.value) {
      headers.set('Authorization', `Bearer ${token.value}`);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expired or invalid
      await logout();
      throw new Error('Authentication expired');
    }

    return response;
  }

  return {
    // State
    user: computed(() => user.value),
    token: computed(() => token.value),
    isAuthenticated,
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),

    // Methods
    initialize,
    register,
    login,
    logout,
    isAdmin,
    apiRequest,
  };
}
