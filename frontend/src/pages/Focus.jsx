import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { subjectsApi, sessionsApi, getErrorMessage } from "../services/api.js";
import { audioService } from "../services/audioService.js";
import AudioController from "../components/AudioController.jsx";
import { firstName, formatDuration } from "../utils/helpers.js";

const PRESETS = [
  { id: "focus-25", name: "Pomodoro", minutes: 25, type: "study" },
  { id: "focus-50", name: "Deep Work", minutes: 50, type: "study" },
  { id: "break-short", name: "Short Break", minutes: 5, type: "break" },
  { id: "break-long", name: "Long Break", minutes: 15, type: "break" },
];

const QUOTES = [
  { text: "Focus is a muscle. Every minute here makes you sharper.", author: "Deep Work Principle" },
  { text: "Action precedes motivation. Just start the clock.", author: "Scholarwise Flow" },
  { text: "Consistency beats intensity. One session at a time.", author: "Study Philosophy" },
  { text: "Small steady disciplines repeated daily bring monumental results.", author: "Habits Guide" },
];

export default function Focus() {
  const { user } = useAuth();

  // Active top tab: "timer" | "stopwatch" | "clock"
  const [tab, setTab] = useState("timer");

  // --- Pomodoro / Timer state ---
  const [preset, setPreset] = useState(PRESETS[0]);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(25 * 60);
  const [timerTotalSeconds, setTimerTotalSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pomoCount, setPomoCount] = useState(0);

  // --- Stopwatch state ---
  const [stopwatchElapsed, setStopwatchElapsed] = useState(0); // in milliseconds
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [laps, setLaps] = useState([]);

  // --- Real-time Clock state ---
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- Zen / Fullscreen mode ---
  const [zenMode, setZenMode] = useState(false);

  // --- Subjects & Topic data for Logging ---
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [markTopicCompleted, setMarkTopicCompleted] = useState(false);

  // --- Logging Modal / Toast ---
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logMinutes, setLogMinutes] = useState(25);
  const [savingSession, setSavingSession] = useState(false);
  const [banner, setBanner] = useState(null);

  // --- User daily intention note ---
  const [intention, setIntention] = useState(() => {
    return localStorage.getItem("scholarwise_daily_intention") || "";
  });

  // Today's total logged minutes from this session
  const [sessionLoggedMinutes, setSessionLoggedMinutes] = useState(0);

  const timerIntervalRef = useRef(null);
  const stopwatchIntervalRef = useRef(null);
  const lastTickRef = useRef(Date.now());

  // Random quote of the session
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  // Load user's subjects
  useEffect(() => {
    async function loadSubjects() {
      try {
        const list = await subjectsApi.list();
        setSubjects(list || []);
        if (list && list.length > 0) {
          setSelectedSubjectId(list[0].id);
          if (list[0].topics && list[0].topics.length > 0) {
            setSelectedTopicId(list[0].topics[0].id);
          }
        }
      } catch {
        // Non-fatal if offline
      }
    }
    loadSubjects();
  }, []);

  // Update selected topic when subject changes
  const currentSubject = subjects.find((s) => s.id === selectedSubjectId);
  const currentTopics = currentSubject?.topics || [];

  useEffect(() => {
    if (currentTopics.length > 0) {
      if (!currentTopics.some((t) => t.id === selectedTopicId)) {
        setSelectedTopicId(currentTopics[0].id);
      }
    } else {
      setSelectedTopicId("");
    }
  }, [selectedSubjectId, currentTopics, selectedTopicId]);

  // Real-time Clock interval
  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Save intention to localStorage
  const handleIntentionChange = (e) => {
    const val = e.target.value;
    setIntention(val);
    localStorage.setItem("scholarwise_daily_intention", val);
  };

  // --- Timer Tick Handler ---
  useEffect(() => {
    if (timerRunning) {
      lastTickRef.current = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const deltaSec = Math.round((now - lastTickRef.current) / 1000);
        if (deltaSec >= 1) {
          lastTickRef.current = now;
          setTimerSecondsLeft((prev) => {
            if (prev <= deltaSec) {
              clearInterval(timerIntervalRef.current);
              setTimerRunning(false);
              if (soundEnabled) audioService.playChime();

              // Prompt session logging if it was a focus session
              if (preset.type === "study") {
                setPomoCount((c) => c + 1);
                const duration = Math.round(timerTotalSeconds / 60);
                setLogMinutes(duration);
                setLogModalOpen(true);
                setBanner({
                  kind: "success",
                  text: `🔥 Great focus! You completed a ${duration}-minute session. Log it below to record your progress.`,
                });
              } else {
                setBanner({
                  kind: "info",
                  text: "☕ Break is over! Ready to dive back in?",
                });
              }
              return 0;
            }
            return prev - deltaSec;
          });
        }
      }, 500);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerRunning, preset, timerTotalSeconds, soundEnabled]);

  // --- Stopwatch Tick Handler ---
  useEffect(() => {
    if (stopwatchRunning) {
      let lastTime = Date.now();
      stopwatchIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const delta = now - lastTime;
        lastTime = now;
        setStopwatchElapsed((prev) => prev + delta);
      }, 33); // ~30 fps update for crisp millisecond rendering
    } else {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    }
    return () => {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    };
  }, [stopwatchRunning]);

  // --- Timer Controls ---
  const startTimer = () => {
    audioService.playClick();
    setTimerRunning(true);
  };

  const pauseTimer = () => {
    audioService.playClick();
    setTimerRunning(false);
  };

  const resetTimer = () => {
    audioService.playClick();
    setTimerRunning(false);
    setTimerSecondsLeft(timerTotalSeconds);
  };

  const addFiveMinutes = () => {
    audioService.playClick();
    setTimerSecondsLeft((prev) => prev + 300);
    setTimerTotalSeconds((prev) => prev + 300);
  };

  const applyPreset = (p) => {
    audioService.playClick();
    setPreset(p);
    setShowCustomInput(false);
    setTimerRunning(false);
    const secs = p.minutes * 60;
    setTimerTotalSeconds(secs);
    setTimerSecondsLeft(secs);
  };

  const handleCustomApply = () => {
    const mins = parseInt(customMinutes, 10);
    if (!mins || mins <= 0 || mins > 240) return;
    audioService.playClick();
    const custom = { id: "custom", name: `Custom ${mins}m`, minutes: mins, type: "study" };
    setPreset(custom);
    setTimerTotalSeconds(mins * 60);
    setTimerSecondsLeft(mins * 60);
    setTimerRunning(false);
    setShowCustomInput(false);
  };

  // --- Stopwatch Controls ---
  const startStopwatch = () => {
    audioService.playClick();
    setStopwatchRunning(true);
  };

  const pauseStopwatch = () => {
    audioService.playClick();
    setStopwatchRunning(false);
  };

  const resetStopwatch = () => {
    audioService.playClick();
    setStopwatchRunning(false);
    setStopwatchElapsed(0);
    setLaps([]);
  };

  const recordLap = () => {
    audioService.playClick();
    const currentLapTime = laps.length === 0 ? stopwatchElapsed : stopwatchElapsed - laps[0].overall;
    setLaps([{ id: laps.length + 1, lapTime: currentLapTime, overall: stopwatchElapsed }, ...laps]);
  };

  const logStopwatchSession = () => {
    const minutes = Math.max(1, Math.round(stopwatchElapsed / 60000));
    setLogMinutes(minutes);
    setLogModalOpen(true);
  };

  // --- Record Session to Backend ---
  const handleSaveSession = async (e) => {
    e.preventDefault();
    if (logMinutes <= 0) return;
    setSavingSession(true);
    try {
      const payload = {
        duration: logMinutes,
        subject_id: selectedSubjectId || null,
        topic_id: selectedTopicId || null,
        label: customLabel.trim() || undefined,
        mark_topic_completed: markTopicCompleted,
      };

      const res = await sessionsApi.record(payload);
      setSessionLoggedMinutes((prev) => prev + logMinutes);
      setLogModalOpen(false);
      setCustomLabel("");
      setMarkTopicCompleted(false);
      setBanner({
        kind: "success",
        text: `🎉 Successfully recorded ${logMinutes}m focus session! Check your Dashboard & Progress to see the update.`,
      });
    } catch (err) {
      setBanner({
        kind: "error",
        text: getErrorMessage(err, "Failed to record study session."),
      });
    } finally {
      setSavingSession(false);
    }
  };

  // Keyboard shortcuts (Space = Toggle Play/Pause, R = Reset, F = Zen Mode)
  useEffect(() => {
    function handleKeyDown(e) {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (tab === "timer") {
          timerRunning ? pauseTimer() : startTimer();
        } else if (tab === "stopwatch") {
          stopwatchRunning ? pauseStopwatch() : startStopwatch();
        }
      } else if (e.key.toLowerCase() === "r") {
        if (tab === "timer") resetTimer();
        if (tab === "stopwatch") resetStopwatch();
      } else if (e.key.toLowerCase() === "f") {
        setZenMode((z) => !z);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tab, timerRunning, stopwatchRunning]);

  // Formatter helpers
  const timerMinutes = Math.floor(timerSecondsLeft / 60);
  const timerSeconds = timerSecondsLeft % 60;
  const timerDisplay = `${String(timerMinutes).padStart(2, "0")}:${String(timerSeconds).padStart(2, "0")}`;
  const timerPercent = timerTotalSeconds > 0 ? ((timerTotalSeconds - timerSecondsLeft) / timerTotalSeconds) * 100 : 0;

  const swHrs = Math.floor(stopwatchElapsed / 3600000);
  const swMins = Math.floor((stopwatchElapsed % 3600000) / 60000);
  const swSecs = Math.floor((stopwatchElapsed % 60000) / 1000);
  const swMillis = Math.floor((stopwatchElapsed % 1000) / 10);
  const stopwatchDisplay = `${swHrs > 0 ? String(swHrs).padStart(2, "0") + ":" : ""}${String(swMins).padStart(2, "0")}:${String(swSecs).padStart(2, "0")}.${String(swMillis).padStart(2, "0")}`;

  const formatLapTime = (ms) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };

  // Dynamic greeting for Clock mode
  const hour = currentTime.getHours();
  let greetingTime = "Daytime Focus";
  if (hour < 5) greetingTime = "Late Night Flow";
  else if (hour < 12) greetingTime = "Morning Deep Work";
  else if (hour < 17) greetingTime = "Afternoon Study Sprint";
  else if (hour < 21) greetingTime = "Evening Flow";
  else greetingTime = "Night Focus Session";

  // SVG Progress Ring calculations
  const RING_R = 120;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;
  const strokeOffset = RING_CIRCUMFERENCE - (timerPercent / 100) * RING_CIRCUMFERENCE;

  return (
    <div className={`focus-page-container ${zenMode ? "zen-mode-active" : ""}`}>
      {/* Zen Mode Exit button */}
      {zenMode && (
        <button
          className="button zen-exit-btn"
          onClick={() => setZenMode(false)}
          title="Exit Zen Mode (Press Esc or F)"
        >
          ✕ Exit Zen Mode
        </button>
      )}

      {/* Main Page Header */}
      {!zenMode && (
        <div className="section-head focus-page-header">
          <div>
            <div className="retro-kicker-row" style={{ marginBottom: 6 }}>
              <span className="retro-badge-date">SCHOLAWISE FOCUS ROOM</span>
              <span className="retro-pill-status">⚡ STUDY MODE</span>
            </div>
            <h1 className="focus-header-title">Focus &amp; Study Clock</h1>
            <p className="focus-header-sub">
              Pomodoro study timer, precision stopwatch, and ambient clock to enter deep flow and log your study hours.
            </p>
          </div>

          <div className="focus-header-actions">
            <button
              className="button retro-btn-outline"
              onClick={() => setZenMode(true)}
              title="Fullscreen Zen Study Mode (Shortcut: F)"
            >
              <span>⛶</span> Zen Mode
            </button>
            <button
              className="button retro-btn-primary"
              onClick={() => {
                setLogMinutes(25);
                setLogModalOpen(true);
              }}
            >
              <span>+</span> Log Study Session
            </button>
          </div>
        </div>
      )}

      {/* Banner Notifications */}
      {banner && (
        <div className={`banner banner-${banner.kind} animate-pop`} style={{ marginBottom: 20 }}>
          <span>{banner.text}</span>
          <button className="banner-close" onClick={() => setBanner(null)}>✕</button>
        </div>
      )}

      {/* Top Mode Selector Tabs */}
      {!zenMode && (
        <div className="focus-tab-nav">
          <button
            className={`focus-tab-btn ${tab === "timer" ? "active" : ""}`}
            onClick={() => {
              sounds.playClick();
              setTab("timer");
            }}
          >
            <span className="tab-icon">⏱️</span>
            <span>Pomodoro Timer</span>
            {pomoCount > 0 && <span className="tab-badge">{pomoCount} Done</span>}
          </button>
          <button
            className={`focus-tab-btn ${tab === "stopwatch" ? "active" : ""}`}
            onClick={() => {
              sounds.playClick();
              setTab("stopwatch");
            }}
          >
            <span className="tab-icon">⚡</span>
            <span>Stopwatch</span>
            {stopwatchRunning && <span className="tab-pulsing-dot" />}
          </button>
          <button
            className={`focus-tab-btn ${tab === "clock" ? "active" : ""}`}
            onClick={() => {
              sounds.playClick();
              setTab("clock");
            }}
          >
            <span className="tab-icon">🕰️</span>
            <span>Desk Clock &amp; Ambient</span>
          </button>
        </div>
      )}

      {/* Main Focus Canvas Grid */}
      <div className={`focus-main-grid ${zenMode ? "zen-grid" : ""}`}>
        {/* Left / Center: Clock / Timer Display Card */}
        <div className="focus-timer-card">
          {/* TAB 1: POMODORO TIMER */}
          {tab === "timer" && (
            <div className="timer-view-wrap">
              {/* Preset Selector */}
              <div className="preset-pill-row">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className={`preset-pill ${preset.id === p.id && !showCustomInput ? "active" : ""} ${p.type === "break" ? "break-pill" : ""}`}
                    onClick={() => applyPreset(p)}
                  >
                    {p.name} <span className="preset-min">({p.minutes}m)</span>
                  </button>
                ))}
                <button
                  className={`preset-pill ${showCustomInput ? "active" : ""}`}
                  onClick={() => setShowCustomInput((v) => !v)}
                >
                  ⚙️ Custom
                </button>
              </div>

              {/* Custom Minutes Input Popover */}
              {showCustomInput && (
                <div className="custom-input-bar animate-pop">
                  <label htmlFor="custom-mins">Duration (minutes):</label>
                  <input
                    id="custom-mins"
                    type="number"
                    min="1"
                    max="240"
                    placeholder="e.g. 45"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCustomApply()}
                  />
                  <button className="button primary sm" onClick={handleCustomApply}>
                    Set Timer
                  </button>
                </div>
              )}

              {/* Circular Timer Ring */}
              <div className="timer-circular-container">
                <svg className="timer-svg" viewBox="0 0 280 280">
                  <defs>
                    <linearGradient id="focusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--retro-red, #D8222A)" />
                      <stop offset="100%" stopColor="#FA5252" />
                    </linearGradient>
                    <linearGradient id="breakGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#16A34A" />
                      <stop offset="100%" stopColor="#4ADE80" />
                    </linearGradient>
                  </defs>
                  <circle className="timer-circle-track" cx="140" cy="140" r={RING_R} />
                  <circle
                    className={`timer-circle-fill ${preset.type === "break" ? "break" : ""}`}
                    cx="140"
                    cy="140"
                    r={RING_R}
                    stroke={preset.type === "break" ? "url(#breakGrad)" : "url(#focusGrad)"}
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={strokeOffset}
                  />
                </svg>

                {/* Center Content */}
                <div className="timer-center-info">
                  <span className={`timer-mode-tag ${preset.type === "break" ? "tag-break" : "tag-focus"}`}>
                    {preset.type === "break" ? "☕ BREAK TIME" : "🎯 DEEP FOCUS"}
                  </span>
                  <div className="timer-digits-display">
                    {timerDisplay}
                  </div>
                  <div className="timer-status-hint">
                    {timerRunning ? "Focusing... Keep going" : timerSecondsLeft === 0 ? "Completed!" : "Ready to Start"}
                  </div>
                </div>
              </div>

              {/* Timer Controls Row */}
              <div className="timer-controls-row">
                <button
                  className="button ghost timer-aux-btn"
                  onClick={resetTimer}
                  title="Reset (R)"
                >
                  ↺ Reset
                </button>

                {timerRunning ? (
                  <button className="button retro-btn-primary timer-main-btn pause" onClick={pauseTimer}>
                    <span>❚❚</span> Pause
                  </button>
                ) : (
                  <button className="button retro-btn-primary timer-main-btn" onClick={startTimer}>
                    <span>▶</span> {timerSecondsLeft < timerTotalSeconds ? "Resume" : "Start Focus"}
                  </button>
                )}

                <button
                  className="button ghost timer-aux-btn"
                  onClick={addFiveMinutes}
                  title="Add 5 Minutes"
                >
                  +5m
                </button>
              </div>

              {/* Sound & Auxiliary Toggles */}
              <div className="timer-footer-aux">
                <button
                  className={`aux-toggle-chip ${soundEnabled ? "active" : ""}`}
                  onClick={() => setSoundEnabled((v) => !v)}
                  title="Bell Chime Sound at 00:00"
                >
                  <span>{soundEnabled ? "🔔" : "🔕"}</span> Chime: {soundEnabled ? "On" : "Muted"}
                </button>

                <button
                  className="aux-toggle-chip"
                  onClick={() => {
                    const duration = Math.max(1, Math.round((timerTotalSeconds - timerSecondsLeft) / 60));
                    setLogMinutes(duration || preset.minutes);
                    setLogModalOpen(true);
                  }}
                  title="Log current progress as a study session"
                >
                  <span>📝</span> Log Session
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: STOPWATCH */}
          {tab === "stopwatch" && (
            <div className="stopwatch-view-wrap">
              <div className="stopwatch-dial-container">
                <span className="stopwatch-kicker">PRECISION STUDY STOPWATCH</span>
                <div className="stopwatch-digits-display">
                  {stopwatchDisplay}
                </div>
                <p className="stopwatch-sub">
                  Track open-ended study, lecture review, or speed problem solving.
                </p>
              </div>

              {/* Stopwatch Action Controls */}
              <div className="timer-controls-row">
                <button
                  className="button ghost timer-aux-btn"
                  onClick={resetStopwatch}
                  disabled={stopwatchElapsed === 0}
                  title="Reset (R)"
                >
                  ↺ Reset
                </button>

                {stopwatchRunning ? (
                  <button className="button retro-btn-primary timer-main-btn pause" onClick={pauseStopwatch}>
                    <span>❚❚</span> Pause
                  </button>
                ) : (
                  <button className="button retro-btn-primary timer-main-btn" onClick={startStopwatch}>
                    <span>▶</span> {stopwatchElapsed > 0 ? "Resume" : "Start"}
                  </button>
                )}

                <button
                  className="button ghost timer-aux-btn"
                  onClick={recordLap}
                  disabled={!stopwatchRunning}
                  title="Record Lap Split"
                >
                  ⚑ Lap
                </button>
              </div>

              {/* Save Elapsed as Study Session button */}
              {stopwatchElapsed > 60000 && (
                <div className="stopwatch-save-bar animate-pop">
                  <span>Logged {formatLapTime(stopwatchElapsed)} so far.</span>
                  <button className="button primary sm" onClick={logStopwatchSession}>
                    Save as Study Session →
                  </button>
                </div>
              )}

              {/* Lap Splits Table */}
              {laps.length > 0 && (
                <div className="stopwatch-laps-card animate-pop">
                  <div className="laps-head">
                    <span>Lap</span>
                    <span>Split Time</span>
                    <span>Overall</span>
                  </div>
                  <div className="laps-body">
                    {laps.map((lap) => (
                      <div key={lap.id} className="lap-row">
                        <span className="lap-id">Lap #{lap.id}</span>
                        <span className="lap-split">+{formatLapTime(lap.lapTime)}</span>
                        <span className="lap-total">{formatLapTime(lap.overall)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DESK CLOCK & AMBIENT ZEN */}
          {tab === "clock" && (
            <div className="deskclock-view-wrap">
              <div className="retro-desk-clock-card">
                <div className="clock-vibe-tag">
                  <span>✨ {greetingTime.toUpperCase()}</span>
                </div>

                <div className="clock-flip-display">
                  <div className="flip-cell">
                    <span className="flip-num">
                      {String(currentTime.getHours() % 12 || 12).padStart(2, "0")}
                    </span>
                    <span className="flip-label">HOURS</span>
                  </div>
                  <span className="flip-colon">:</span>
                  <div className="flip-cell">
                    <span className="flip-num">
                      {String(currentTime.getMinutes()).padStart(2, "0")}
                    </span>
                    <span className="flip-label">MINUTES</span>
                  </div>
                  <span className="flip-colon">:</span>
                  <div className="flip-cell">
                    <span className="flip-num">
                      {String(currentTime.getSeconds()).padStart(2, "0")}
                    </span>
                    <span className="flip-label">SECONDS</span>
                  </div>
                  <div className="flip-ampm">
                    {currentTime.getHours() >= 12 ? "PM" : "AM"}
                  </div>
                </div>

                <div className="clock-date-bar">
                  <span>📅 {currentTime.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                </div>
              </div>

              {/* Sound Lab & Ambient Controls */}
              <AudioController embedded={true} />
            </div>
          )}
        </div>

        {/* Right: Study Session Companion Sidebar (hidden in Zen mode) */}
        {!zenMode && (
          <div className="focus-sidebar-card">
            {/* Quick Session Intention / Note */}
            <div className="card-section intention-section">
              <div className="section-label-row">
                <span className="sec-label">🎯 Today's Intention</span>
              </div>
              <textarea
                className="intention-textarea"
                rows={2}
                placeholder="What single topic or problem are you conquering right now?"
                value={intention}
                onChange={handleIntentionChange}
              />
            </div>

            {/* Today's Focus Stats */}
            <div className="card-section focus-stats-section">
              <div className="sec-label">📊 Session Overview</div>
              <div className="focus-stats-grid">
                <div className="fstat-box">
                  <span className="fstat-num">{sessionLoggedMinutes}m</span>
                  <span className="fstat-label">Logged Today</span>
                </div>
                <div className="fstat-box">
                  <span className="fstat-num">{pomoCount}</span>
                  <span className="fstat-label">Pomodoros</span>
                </div>
                <div className="fstat-box">
                  <span className="fstat-num">{laps.length}</span>
                  <span className="fstat-label">Laps Recorded</span>
                </div>
                <div className="fstat-box">
                  <span className="fstat-num">{subjects.length}</span>
                  <span className="fstat-label">Subjects</span>
                </div>
              </div>
            </div>

            {/* Quick Log Current Subject / Topic Widget */}
            <div className="card-section quick-subject-section">
              <div className="sec-label">📚 Linked Study Subject</div>
              {subjects.length === 0 ? (
                <p className="empty-hint">
                  No subjects added yet. <Link to="/subjects">Add subjects →</Link>
                </p>
              ) : (
                <div className="quick-subject-selectors">
                  <div className="form-group sm">
                    <label>Subject</label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {currentTopics.length > 0 && (
                    <div className="form-group sm">
                      <label>Topic</label>
                      <select
                        value={selectedTopicId}
                        onChange={(e) => setSelectedTopicId(e.target.value)}
                      >
                        {currentTopics.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.status === "completed" ? "✓" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Motivational Quote */}
            <div className="card-section quote-section">
              <div className="quote-text">“{quote.text}”</div>
              <div className="quote-author">— {quote.author}</div>
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className="card-section keyboard-tips">
              <div className="tips-head">⌨ Shortcuts</div>
              <div className="tip-item"><kbd>Space</kbd> Start / Pause</div>
              <div className="tip-item"><kbd>R</kbd> Reset Timer</div>
              <div className="tip-item"><kbd>F</kbd> Toggle Zen Mode</div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Record Study Session to Backend API */}
      {logModalOpen && (
        <div className="modal-backdrop animate-fade" onClick={() => !savingSession && setLogModalOpen(false)}>
          <div className="modal-card log-session-modal animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="modal-kicker">SCHOLAWISE SESSION RECORDER</span>
                <h2>Record Study Time</h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setLogModalOpen(false)}
                disabled={savingSession}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSession}>
              <div className="form-group">
                <label htmlFor="log-dur">Study Duration (Minutes)</label>
                <input
                  id="log-dur"
                  type="number"
                  min="1"
                  max="480"
                  required
                  value={logMinutes}
                  onChange={(e) => setLogMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="log-subj">Subject</label>
                <select
                  id="log-subj"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                >
                  <option value="">General / Self Study</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {currentTopics.length > 0 && selectedSubjectId && (
                <div className="form-group">
                  <label htmlFor="log-top">Topic</label>
                  <select
                    id="log-top"
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                  >
                    <option value="">Focused Study</option>
                    {currentTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="log-lbl">Session Note / Label (Optional)</label>
                <input
                  id="log-lbl"
                  type="text"
                  placeholder="e.g. Practiced problem set, completed notes"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                />
              </div>

              {selectedTopicId && (
                <div className="checkbox-field" style={{ margin: "14px 0" }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={markTopicCompleted}
                      onChange={(e) => setMarkTopicCompleted(e.target.checked)}
                    />
                    Mark this topic as completed
                  </label>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setLogModalOpen(false)}
                  disabled={savingSession}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button retro-btn-primary"
                  disabled={savingSession}
                >
                  {savingSession ? "Saving..." : `Save ${logMinutes}m to Progress`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
