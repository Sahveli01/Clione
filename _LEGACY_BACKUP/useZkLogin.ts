"use client";

import { useState, useCallback, useEffect } from "react";
import { computeZkLoginAddress, getJwtIssuer, getEmailFromJwt } from "@/lib/zk-utils";

export function useZkLogin() {
  const [jwt, setJwt] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load JWT from localStorage on mount
  useEffect(() => {
    const storedJwt = localStorage.getItem("zkLogin_jwt");
    if (storedJwt) {
      setJwt(storedJwt);
    }
  }, []);

  const login = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const clientId =
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
        "YOUR_GOOGLE_CLIENT_ID";

      if (clientId === "YOUR_GOOGLE_CLIENT_ID") {
        throw new Error("Google Client ID not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID");
      }

      // Generate a random nonce for OAuth
      const nonce = crypto.randomUUID();
      const redirectUri = `${window.location.origin}/oauth/callback`;

      // Store nonce in sessionStorage for verification
      sessionStorage.setItem("oauth_nonce", nonce);

      // Construct Google OAuth URL
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "id_token",
        scope: "openid email",
        nonce: nonce,
      });

      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      // Open OAuth popup
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        googleAuthUrl,
        "Google Login",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        throw new Error("Popup blocked. Please allow popups for this site.");
      }

      // Wait for OAuth callback
      // The callback will post a message with the JWT
      return new Promise<void>((resolve, reject) => {
        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;

          if (event.data.type === "zkLogin_JWT") {
            const receivedJwt = event.data.jwt;
            setJwt(receivedJwt);
            localStorage.setItem("zkLogin_jwt", receivedJwt);
            popup.close();
            window.removeEventListener("message", messageHandler);
            setIsLoading(false);
            resolve();
          } else if (event.data.type === "zkLogin_ERROR") {
            popup.close();
            window.removeEventListener("message", messageHandler);
            setIsLoading(false);
            reject(new Error(event.data.error));
          }
        };

        window.addEventListener("message", messageHandler);

        // Check if popup is closed manually
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener("message", messageHandler);
            setIsLoading(false);
            reject(new Error("Login cancelled"));
          }
        }, 1000);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setIsLoading(false);
      throw err;
    }
  }, []);

  const computeAddress = useCallback(
    (masterSalt: string) => {
      if (!jwt) {
        throw new Error("JWT not available");
      }

      const issuer = getJwtIssuer(jwt);
      const email = getEmailFromJwt(jwt);
      const computedAddress = computeZkLoginAddress(issuer, email, masterSalt);
      setAddress(computedAddress);
      return computedAddress;
    },
    [jwt]
  );

  const logout = useCallback(() => {
    setJwt(null);
    setAddress(null);
    localStorage.removeItem("zkLogin_jwt");
  }, []);

  return {
    isAuthenticated: !!jwt && !!address,
    jwt,
    address,
    isLoading,
    error,
    login,
    computeAddress,
    logout,
  };
}

