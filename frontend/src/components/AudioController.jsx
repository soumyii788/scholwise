import { useEffect, useState } from "react";
import { audioService } from "../services/audioService.js";

const AMBIENT_TRACKS = [
  {
    id: "rain",
    name: "Gentle Rain",
    emoji: "🌧️",
    desc: "Multi-layered soft drizzle",
  },
  {
    id: "waves",
    name: "Ocean Surf",
    emoji: "🌊",
    desc: "Rhythmic rolling coastal swell",
  },
  {
    id: "cafe",
    name: "Deep Brown Noise",
    emoji: "☕",
    desc: "Warm low-frequency concentration",
  },
  {
    id: "fire",
    name: "Campfire Embers",
    emoji: "🪵",
    desc: "Cozy wood hearth with crackles",
  },
  {
    id: "clock",
    name: "Desk Clock",
    emoji: "🕰️",
    desc: "Subtle rhythmic 1-second cadence",
  },
];

const CHIME_TYPES = [
  { id: "tibetan", name: "Tibetan Bowl", desc: "432 Hz warm resonant bell" },
  { id: "crystal", name: "Crystal Chime", desc: "D5/A5 dual harmonic chime" },
  { id: "ding", name: "Soft Ding", desc: "Gentle acoustic notification" },
];

export default function AudioController({ embedded = false }) {
  const [audioState, setAudioState] = useState(() => audioService.getState());
  const [testingChime, setTestingChime] = useState(false);

  useEffect(() => {
    const unsubscribe = audioService.subscribe((state) => {
      setAudioState(state);
    });
    return () => unsubscribe();
  }, []);

  const handleToggleAmbient = (trackId) => {
    audioService.startAmbient(trackId);
  };

  const handleTestChime = async (type) => {
    setTestingChime(true);
    await audioService.playChime(type || audioState.chimeType);
    setTimeout(() => setTestingChime(false), 2000);
  };

  const handleVolume = (e) => {
    audioService.setAmbientVolume(parseFloat(e.target.value));
  };

  const handleMute = () => {
    audioService.toggleMute();
  };

  const handleSelectChime = (type) => {
    audioService.setChimeType(type);
    audioService.playChime(type);
  };

  return (
    <div className={`audio-sound-lab ${embedded ? "embedded" : ""}`}>
      {/* Header with Visualizer and Status */}
      <div className="sound-lab-header">
        <div className="sound-lab-title-group">
          <div className="sound-lab-icon-wrap">
            <span className="sound-main-icon">🎧</span>
            {audioState.currentAmbient && !audioState.isMuted && (
              <span className="audio-live-pulse" title="Ambient audio active" />
            )}
          </div>
          <div>
            <h3 className="sound-lab-title">Scholarwise Sound Lab</h3>
            <p className="sound-lab-sub">
              100% browser synthesized ambient audio &amp; focus chimes · Zero lag
            </p>
          </div>
        </div>

        {/* Live Audio Visualizer Bars */}
        <div className={`audio-visualizer-bars ${audioState.currentAmbient && !audioState.isMuted ? "playing" : ""}`}>
          <span className="bar bar-1" />
          <span className="bar bar-2" />
          <span className="bar bar-3" />
          <span className="bar bar-4" />
          <span className="bar bar-5" />
        </div>
      </div>

      {/* Ambient Soundscapes Grid */}
      <div className="ambient-grid-wrapper">
        <div className="sound-section-label">
          <span>🌿 Ambient Background Noise</span>
          {audioState.currentAmbient && (
            <button
              className="link-button sound-stop-all"
              onClick={() => audioService.stopAmbient()}
            >
              Stop Sound
            </button>
          )}
        </div>

        <div className="ambient-cards-grid">
          {AMBIENT_TRACKS.map((t) => {
            const isActive = audioState.currentAmbient === t.id && !audioState.isMuted;
            return (
              <button
                key={t.id}
                className={`ambient-card-btn ${isActive ? "active" : ""}`}
                onClick={() => handleToggleAmbient(t.id)}
              >
                <div className="ambient-card-icon">{t.emoji}</div>
                <div className="ambient-card-info">
                  <span className="ambient-card-name">{t.name}</span>
                  <span className="ambient-card-desc">{t.desc}</span>
                </div>
                <div className="ambient-card-badge">
                  {isActive ? "Playing" : "Play"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ambient Volume Control Bar */}
      <div className="sound-controls-bar">
        <button
          className={`sound-mute-btn ${audioState.isMuted ? "muted" : ""}`}
          onClick={handleMute}
          title={audioState.isMuted ? "Unmute Audio" : "Mute Audio"}
        >
          {audioState.isMuted ? "🔇 Muted" : "🔊 Sound On"}
        </button>

        <div className="sound-slider-group">
          <label htmlFor="sound-vol">Volume ({Math.round(audioState.ambientVolume * 100)}%)</label>
          <input
            id="sound-vol"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={audioState.ambientVolume}
            onChange={handleVolume}
            disabled={audioState.isMuted}
          />
        </div>
      </div>

      {/* Completion Bells & Chimes Selector with Test Button */}
      <div className="chime-selector-box">
        <div className="sound-section-label">
          <span>🔔 Session Completion Chimes</span>
          <span className="chime-hint">Plays when Pomodoro reaches 00:00</span>
        </div>

        <div className="chime-options-row">
          {CHIME_TYPES.map((c) => (
            <button
              key={c.id}
              className={`chime-option-chip ${audioState.chimeType === c.id ? "active" : ""}`}
              onClick={() => handleSelectChime(c.id)}
            >
              <span className="chime-chip-title">{c.name}</span>
              <span className="chime-chip-desc">{c.desc}</span>
            </button>
          ))}
        </div>

        <div className="chime-test-row">
          <button
            className={`button retro-btn-outline chime-test-btn ${testingChime ? "ringing" : ""}`}
            onClick={() => handleTestChime()}
          >
            <span>🔔</span> {testingChime ? "Ringing Bell..." : "Test Chime Sound Now"}
          </button>
          <span className="chime-test-note">
            Click to verify your speakers/headphones can play audio.
          </span>
        </div>
      </div>
    </div>
  );
}
