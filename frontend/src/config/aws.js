/**
 * AWS Amplify + API configuration
 * Values are injected at build time via environment variables (Vite)
 * or overridden by GitHub Actions secrets
 */
export const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId:       import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      signUpVerificationMethod: 'code',
    },
  },
};

export const API_BASE_URL = import.meta.env.VITE_API_URL;
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
