/**
 * OAuth Callback Page
 * Handles Google OAuth redirect and sends token back to background service
 */

import { useEffect, useState } from "react";

function OAuthCallback() {
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processing sign-in...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract ID token from URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const idToken = hashParams.get("id_token");
        const error = hashParams.get("error");

        if (error) {
          setStatus("error");
          setMessage(`Sign-in failed: ${error}`);
          return;
        }

        if (!idToken) {
          setStatus("error");
          setMessage("No authentication token received. Please try again.");
          return;
        }

        // Send token to background service
        const response = await chrome.runtime.sendMessage({
          type: "OAUTH_CALLBACK",
          payload: { idToken },
        });

        if (response?.success) {
          setStatus("success");
          setMessage("Sign-in successful! You can close this tab.");

          // Auto-close tab after short delay
          setTimeout(() => {
            window.close();
          }, 1500);
        } else {
          setStatus("error");
          setMessage(response?.error || "Failed to complete sign-in.");
        }
      } catch (err) {
        console.error("[OAuth Callback] Error:", err);
        setStatus("error");
        setMessage("An error occurred during sign-in.");
      }
    };

    handleCallback();
  }, []);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      fontFamily: "system-ui, -apple-system, sans-serif",
      backgroundColor: "#f5f5f5",
      padding: "20px",
    }}>
      <div style={{
        backgroundColor: "white",
        borderRadius: "12px",
        padding: "40px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        textAlign: "center",
        maxWidth: "400px",
      }}>
        <h1 style={{
          fontSize: "24px",
          marginBottom: "16px",
          color: status === "error" ? "#dc2626" : status === "success" ? "#16a34a" : "#374151",
        }}>
          {status === "processing" && "Signing in..."}
          {status === "success" && "Success!"}
          {status === "error" && "Error"}
        </h1>

        <p style={{
          color: "#6b7280",
          fontSize: "16px",
          lineHeight: "1.5",
        }}>
          {message}
        </p>

        {status === "processing" && (
          <div style={{
            marginTop: "20px",
            width: "40px",
            height: "40px",
            border: "3px solid #e5e7eb",
            borderTop: "3px solid #3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "20px auto 0",
          }} />
        )}

        {status === "error" && (
          <button
            onClick={() => window.close()}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Close
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default OAuthCallback;
