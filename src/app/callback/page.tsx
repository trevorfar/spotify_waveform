"use client";
import { useEffect, useState, useRef } from "react";

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface SpotifyTrack {
  name: string;
  uri: string;
  id: string | null;
  duration_ms: number;
}

interface PlayerState {
  track_window: {
    current_track: SpotifyTrack;
  };
  position: number;
  paused: boolean;
}

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;

const Auth = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<SpotifyTrack | null>(null);
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const checkTokenValidity = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.ok;
    } catch (error) {
      console.error("Token check failed:", error);
      return false;
    }
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem("spotify_refresh_token");
    if (!refreshToken) return null;

    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(
            `${CLIENT_ID}:${process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_SECRET}`
          )}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });

      const data = await response.json();
      localStorage.setItem("spotify_access_token", data.access_token);
      return data.access_token;
    } catch (error) {
      console.error("Token refresh failed:", error);
      return null;
    }
  };

  const initializeToken = () => {
    
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const urlToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (urlToken) {
      localStorage.setItem("spotify_access_token", urlToken);
      if (refreshToken) {
        localStorage.setItem("spotify_refresh_token", refreshToken);
      }
      setAccessToken(urlToken);
      window.history.pushState({}, document.title, window.location.pathname);
      return;
    }

    const storedToken = localStorage.getItem("spotify_access_token");
    if (storedToken) {
      setAccessToken(storedToken);
    }
  };

  const transferPlayback = async (deviceId: string, play = true) => {
    try {
      let token = accessToken;
      if (!token) return;

      const isValid = await checkTokenValidity(token);
      if (!isValid) {
        token = await refreshAccessToken();
        if (!token) {
          const authParams = new URLSearchParams();
          if (CLIENT_ID) authParams.append("client_id", CLIENT_ID);
          if (REDIRECT_URI) authParams.append("redirect_uri", REDIRECT_URI);
          authParams.append("response_type", "code");
          authParams.append(
            "scope",
            "user-read-playback-state user-modify-playback-state streaming"
          );
          authParams.append("show_dialog", "true");

          window.location.href = `https://accounts.spotify.com/authorize?${authParams.toString()}`;
          return;
        }
        setAccessToken(token);
      }

      const res = await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log("Transfer successful!");
    } catch (error) {
      console.error("Transfer failed:", error);
    }
  };

  const transferToPhone = async () => {
    setIsLoading(true);
    try {
      let token = accessToken;
      console.log(`TOKEN${token}`)
      
      const isValid = token ? await checkTokenValidity(token) : false;
      if (!token) return;

      console.log(isValid)
      if (!isValid) {
        token = await refreshAccessToken();
        
        if (!token) {
          const authParams = new URLSearchParams();
          if (CLIENT_ID) authParams.append("client_id", CLIENT_ID);
          if (REDIRECT_URI) authParams.append("redirect_uri", REDIRECT_URI);
          authParams.append("response_type", "code");
          authParams.append(
            "scope",
            "user-read-playback-state user-modify-playback-state streaming"
          );
          authParams.append("show_dialog", "true");

          window.location.href = `https://accounts.spotify.com/authorize?${authParams.toString()}`;
          return;
        }
        setAccessToken(token);
      }

      const devicesRes = await fetch(
        "https://api.spotify.com/v1/me/player/devices",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!devicesRes.ok) {
        throw new Error(`HTTP ${devicesRes.status}`);
      }

      const { devices } = await devicesRes.json();
      console.log("Available devices:", devices);

      if (!devices || !Array.isArray(devices)) {
        throw new Error("No devices array in response");
      }

      const phone = devices.find(
        (d: { type: string; name: string }) =>
          d.type === "Smartphone" ||
          d.name.includes("iPhone") ||
          d.name.includes("Android")
      );

      if (!phone) {
        console.error("No phone device found. Available devices:", devices);
        return;
      }

      await transferPlayback(phone.id, true);
    } catch (error) {
      console.error("Transfer to phone failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Effects and initialization
  useEffect(() => {
    initializeToken();
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "Audio Visualizer",
        getOAuthToken: (cb) => cb(accessToken!),
        volume: 0.0,
      });

      setPlayer(player);

      player.addListener("ready", ({ device_id }) => {
        console.log("Ready with Device ID", device_id);
        setDeviceId(device_id);
        transferPlayback(device_id);
      });

      player.addListener("not_ready", ({ device_id }) => {
        console.log("Device ID has gone offline", device_id);
      });

      player.addListener(
        "player_state_changed",
        (state: Spotify.PlaybackState | null) => {
          if (!state?.track_window?.current_track) return;
          if (!state?.track_window?.current_track.id) return;
          const currentTrack: SpotifyTrack = {
            name: state.track_window.current_track.name,
            uri: state.track_window.current_track.uri,
            id: state.track_window.current_track.id,
            duration_ms: state.track_window.current_track.duration_ms,
          };

          setNowPlaying(currentTrack);
          visualize(state);
        }
      );

      player.addListener("initialization_error", ({ message }) => {
        console.error("Initialization Error:", message);
      });

      player.addListener("authentication_error", ({ message }) => {
        console.error("Authentication Error:", message);
      });

      player.addListener("account_error", ({ message }) => {
        console.error("Account Error:", message);
      });

      player
        .connect()
        .then(() => {
          player.getCurrentState().then((state) => {
            if (state) {
              const currentTrack = {
                name: state.track_window.current_track.name,
                uri: state.track_window.current_track.uri,
                id: state.track_window.current_track.id,
                duration_ms: state.track_window.current_track.duration_ms,
              };
              setNowPlaying(currentTrack);
              visualize(state);
            }
          });
        })
        .catch((error) => {
          console.error("Failed to connect player:", error);
        });
    };

    return () => {
      player?.disconnect();
    };
  }, [accessToken]);

  // Visualization function remains the same
  const visualize = (state: PlayerState) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const positionPercentage =
      state.position / state.track_window.current_track.duration_ms;
    const isPlaying = !state.paused;

    const barCount = 20;
    const barWidth = canvas.width / barCount;
    const maxHeight = canvas.height * 0.8;

    for (let i = 0; i < barCount; i++) {
      const height = isPlaying
        ? maxHeight * (0.2 + 0.8 * Math.random() * positionPercentage)
        : maxHeight * 0.2;

      ctx.fillStyle = `hsl(${(i * 360) / barCount}, 80%, 50%)`;
      ctx.fillRect(
        i * barWidth + 2,
        canvas.height - height,
        barWidth - 4,
        height
      );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="w-full max-w-4xl space-y-8">
        <h1 className="text-3xl font-bold text-center">
          {nowPlaying ? (
            <>
              Now Playing:{" "}
              <span className="text-green-400">{nowPlaying.name}</span>
            </>
          ) : (
            "Play a track on Spotify to visualize"
          )}
        </h1>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => deviceId && transferPlayback(deviceId)}
            className="px-4 py-2 bg-blue-500 rounded disabled:opacity-50"
            disabled={!deviceId || isLoading}
          >
            {isLoading ? "Loading..." : "Play on Web Player"}
          </button>
          <button
            onClick={transferToPhone}
            className="px-4 py-2 bg-purple-500 rounded disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Play on Phone"}
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={800}
          height={300}
          className="w-full bg-gray-800 rounded-lg shadow-xl"
        />

        <div className="text-center text-gray-400">
          {deviceId ? `Connected to Spotify` : `Connecting...`}
        </div>
      </div>
    </div>
  );
};

export default Auth;
