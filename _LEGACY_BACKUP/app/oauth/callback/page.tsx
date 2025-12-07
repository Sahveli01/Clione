"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function OAuthCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Extract id_token from URL hash (Google OAuth returns it in the hash)
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get("id_token");

    // Verify nonce
    const storedNonce = sessionStorage.getItem("oauth_nonce");
    const urlNonce = params.get("nonce");

    if (idToken) {
      // Verify nonce matches
      if (storedNonce && urlNonce && storedNonce === urlNonce) {
        // Send JWT to parent window
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "zkLogin_JWT",
              jwt: idToken,
            },
            window.location.origin
          );
          window.close();
        } else {
          // If no opener, store in localStorage and redirect
          localStorage.setItem("zkLogin_jwt", idToken);
          window.location.href = "/claim";
        }
      } else {
        // Nonce mismatch
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "zkLogin_ERROR",
              error: "Nonce verification failed",
            },
            window.location.origin
          );
          window.close();
        }
      }
    } else {
      // No token received
      const error = params.get("error") || "Authentication failed";
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "zkLogin_ERROR",
            error: error,
          },
          window.location.origin
        );
        window.close();
      }
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Completing authentication...</p>
      </div>
    </div>
  );
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}

