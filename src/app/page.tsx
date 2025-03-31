"use client";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

const Auth = () => {
  const clientId = process.env.NEXT_PUBLIC_CLIENT_ID || "";
  const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI || "";
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");

    if (token) {
      setAccessToken(token);
      window.history.pushState({}, document.title, window.location.pathname);
    }
  }, []);

  const spotifyLogin = () => {
    const scope = [
      "streaming",
      "user-read-email",
      "user-read-private",
      "user-modify-playback-state",
      "user-read-playback-state",
    ].join(" ");
    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("response_type", "token");
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("scope", scope);
    window.location.href = authUrl.toString();
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        {accessToken ? <>Shouldnt be here</> : <button
          onClick={spotifyLogin}
          className="px-6 py-3 bg-green-500 rounded-full font-bold hover:bg-green-600 transition-colors"
        >
          Login with Spotify
        </button>}
    </div>
)}

export default Auth;
