/**
 * emotion-journal.js
 * Class: EmotionJournal
 *
 * Handles the full video emotion analysis flow:
 *   Camera → Record → Upload → Poll → Display Results → Save
 *
 * Uses only vanilla JS + the existing ApiClient, Storage shared utilities.
 * No external libraries required (Chart.js excluded — no canvas in this design).
 */

/* ── Emotion metadata (colour + emoji) ─────────────────────── */
const EMOTION_META = {
    happy:    { emoji: '😊', bg: 'rgba(58,196,125,0.12)',  fg: '#2d8a56', bar: '#3ac47d' },
    sad:      { emoji: '😢', bg: 'rgba(100,149,237,0.12)', fg: '#3d6dba', bar: '#6495ed' },
    angry:    { emoji: '😠', bg: 'rgba(224,122,95,0.12)',  fg: '#b85a3e', bar: '#e07a5f' },
    fear:     { emoji: '😨', bg: 'rgba(162,132,194,0.12)', fg: '#7b5ea0', bar: '#a284c2' },
    surprise: { emoji: '😲', bg: 'rgba(232,184,109,0.12)', fg: '#b08430', bar: '#e8b86d' },
    disgust:  { emoji: '🤢', bg: 'rgba(130,170,110,0.12)', fg: '#5a7a42', bar: '#82aa6e' },
    neutral:  { emoji: '😐', bg: 'rgba(160,164,168,0.12)', fg: '#636e72', bar: '#a0a4a8' },
};

function emotionMeta(emotion) {
    return EMOTION_META[(emotion || '').toLowerCase()] || EMOTION_META.neutral;
}

/* ── Fake progress animation while polling ─────────────────── */
const PROGRESS_STAGES = [
    { pct: 10, label: 'Uploading video…',          sub: 'Sending to server…',               step: 'upload' },
    { pct: 25, label: 'Extracting video frames…',  sub: 'Sampling 1 frame per second…',     step: 'emotion' },
    { pct: 45, label: 'Detecting facial emotions…',sub: 'Running MediaPipe + feature model…',step: 'emotion' },
    { pct: 60, label: 'Transcribing speech…',      sub: 'Whisper tiny model processing…',   step: 'transcript' },
    { pct: 75, label: 'Analysing sentiment…',      sub: 'DistilBERT INT8 ONNX running…',    step: 'sentiment' },
    { pct: 88, label: 'Generating wellness summary…', sub: 'Combining all signals…',        step: 'wellness' },
    { pct: 96, label: 'Finalising results…',        sub: 'Almost done!',                    step: 'wellness' },
];

/* ════════════════════════════════════════════════════════════
   EmotionJournal class
   ════════════════════════════════════════════════════════════ */
class EmotionJournal {

    constructor() {
        // State
        this.cameraStream    = null;
        this.mediaRecorder   = null;
        this.recordedChunks  = [];
        this.recordedBlob    = null;   // from camera recording
        this.uploadedFile    = null;   // from file input
        this.timerInterval   = null;
        this.timerSeconds    = 0;
        this.pollInterval    = null;
        this.pollAttempts    = 0;
        this.progressStageIdx = 0;
        this.lastResults     = null;

        this._bindElements();
        this._bindEvents();
    }

    /* ── Element references ──────────────────────────────── */
    _bindElements() {
        this.elVideoPreview    = document.getElementById('ej-video-preview');
        this.elVideoPlaceholder= document.getElementById('ej-video-placeholder');
        this.elVideoWrapper    = document.getElementById('ej-video-wrapper');
        this.elTimerDisplay    = document.getElementById('ej-timer-display');
        this.elRecordingTimer  = document.getElementById('ej-recording-timer');
        this.elPlaybackCard    = document.getElementById('ej-playback-card');
        this.elPlaybackVideo   = document.getElementById('ej-playback-video');
        this.elFileSizeHint    = document.getElementById('ej-file-size-hint');

        this.elBtnCamera  = document.getElementById('ej-btn-camera');
        this.elBtnRecord  = document.getElementById('ej-btn-record');
        this.elBtnStop    = document.getElementById('ej-btn-stop');
        this.elBtnRetake  = document.getElementById('ej-btn-retake');
        this.elBtnAnalyze = document.getElementById('ej-btn-analyze');
        this.elReadyHint  = document.getElementById('ej-ready-hint');
        this.elFileInput  = document.getElementById('ej-file-upload');

        this.elCaptureSection    = document.getElementById('ej-capture-section');
        this.elProcessingSection = document.getElementById('ej-processing-section');
        this.elResultsSection    = document.getElementById('ej-results-section');

        this.elProgressFill  = document.getElementById('ej-progress-fill');
        this.elProgressPct   = document.getElementById('ej-progress-pct');
        this.elProcessLabel  = document.getElementById('ej-process-label');
        this.elProcessSub    = document.getElementById('ej-process-sub');

        this.elBtnSave = document.getElementById('ej-btn-save');
        this.elBtnNew  = document.getElementById('ej-btn-new');
    }

    /* ── Event bindings ──────────────────────────────────── */
    _bindEvents() {
        this.elBtnCamera.addEventListener('click',  () => this.startCamera());
        this.elBtnRecord.addEventListener('click',  () => this.startRecording());
        this.elBtnStop.addEventListener('click',    () => this.stopRecording());
        this.elBtnRetake.addEventListener('click',  () => this.retake());
        this.elBtnAnalyze.addEventListener('click', () => this.uploadVideo());
        this.elBtnSave.addEventListener('click',    () => this.saveEntry());
        this.elBtnNew.addEventListener('click',     () => this.resetAll());

        this.elFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const maxBytes = 120 * 1024 * 1024;
            if (file.size > maxBytes) {
                this._toast('File exceeds 120 MB limit. Please use a shorter video.', 'error');
                return;
            }
            this.uploadedFile = file;
            this.recordedBlob = null;

            // Show playback
            const url = URL.createObjectURL(file);
            this.elPlaybackVideo.src = url;
            this.elPlaybackCard.style.display = 'block';
            this.elFileSizeHint.textContent =
                `File: ${file.name}  (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;

            this._setAnalyzeReady(true);
        });

        // Timeline toggle
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'ej-timeline-toggle') {
                this._toggleTimeline();
            }
        });
    }

    /* ── Camera ──────────────────────────────────────────── */
    async startCamera() {
        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            this.elVideoPreview.srcObject = this.cameraStream;
            this.elVideoPreview.style.display = 'block';
            this.elVideoPlaceholder.style.display = 'none';

            this.elBtnCamera.style.display = 'none';
            this.elBtnRecord.style.display = 'inline-flex';
        } catch (err) {
            this._toast('Camera access denied. Please grant permission and retry.', 'error');
            console.error('Camera error:', err);
        }
    }

    /* ── Recording ───────────────────────────────────────── */
    startRecording() {
        if (!this.cameraStream) return;

        this.recordedChunks = [];
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm';
        this.mediaRecorder = new MediaRecorder(this.cameraStream, { mimeType });

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.recordedChunks.push(e.data);
        };

        this.mediaRecorder.onstop = () => {
            this.recordedBlob = new Blob(this.recordedChunks, { type: 'video/webm' });
            this.uploadedFile = null;

            const url = URL.createObjectURL(this.recordedBlob);
            this.elPlaybackVideo.src = url;
            this.elPlaybackCard.style.display = 'block';
            this.elFileSizeHint.textContent =
                `Recorded: ${(this.recordedBlob.size / (1024 * 1024)).toFixed(1)} MB  ·  ${this._formatTime(this.timerSeconds)}`;

            this._setAnalyzeReady(true);
        };

        this.mediaRecorder.start(200); // collect data every 200ms
        this._startTimer();

        this.elBtnRecord.style.display = 'none';
        this.elBtnStop.style.display   = 'inline-flex';
        this.elRecordingTimer.classList.add('active');
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        this._stopTimer();
        this.elBtnStop.style.display   = 'none';
        this.elBtnRetake.style.display = 'inline-flex';
        this.elRecordingTimer.classList.remove('active');
    }

    retake() {
        this.recordedBlob = null;
        this.uploadedFile = null;
        this.elPlaybackCard.style.display = 'none';
        this.elPlaybackVideo.src = '';
        this._setAnalyzeReady(false);

        // Reset to "ready to record" state
        this.elBtnRetake.style.display = 'none';
        this.elBtnRecord.style.display = 'inline-flex';
        this.timerSeconds = 0;

        // Restart stream if needed
        if (!this.cameraStream || !this.cameraStream.active) {
            this.startCamera();
        }
    }

    /* ── Upload & Analysis ───────────────────────────────── */
    async uploadVideo() {
        const blob = this.recordedBlob || this.uploadedFile;
        if (!blob) {
            this._toast('No video to analyse. Please record or upload one.', 'error');
            return;
        }

        const ext = this.uploadedFile ? (this.uploadedFile.name.split('.').pop() || 'webm') : 'webm';
        const formData = new FormData();
        formData.append('video', blob, `journal_entry.${ext}`);

        // Show processing section
        this._showSection('processing');
        this._setProgress(0, 'Uploading video…', 'Sending to server…');
        this._activateStep('upload');

        let entryId = null;
        try {
            const resp = await fetch('/api/journal/analyze', {
                method: 'POST',
                body: formData,
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ detail: resp.statusText }));
                throw new Error(err.detail || `Upload failed (${resp.status})`);
            }

            const data = await resp.json();
            entryId = data.entry_id;
        } catch (err) {
            this._toast(`Upload failed: ${err.message}`, 'error');
            this._showSection('capture');
            return;
        }

        if (!entryId) {
            this._toast('Server did not return a valid entry ID.', 'error');
            this._showSection('capture');
            return;
        }

        // Begin polling
        this.pollAttempts = 0;
        this.progressStageIdx = 1; // skip upload step
        this._setProgress(10, PROGRESS_STAGES[0].label, PROGRESS_STAGES[0].sub);
        this.pollInterval = setInterval(() => this._poll(entryId), 1000);
    }

    async _poll(entryId) {
        this.pollAttempts++;

        // Animate progress stages
        const stageIdx = Math.min(
            Math.floor((this.pollAttempts / 20) * PROGRESS_STAGES.length),
            PROGRESS_STAGES.length - 1
        );
        if (stageIdx !== this.progressStageIdx) {
            this.progressStageIdx = stageIdx;
            const stage = PROGRESS_STAGES[stageIdx];
            this._setProgress(stage.pct, stage.label, stage.sub);
            this._activateStep(stage.step);
        }

        // Stop polling after 2 minutes
        if (this.pollAttempts > 120) {
            clearInterval(this.pollInterval);
            this._toast('Analysis timed out. Please try again.', 'error');
            this._showSection('capture');
            return;
        }

        try {
            const resp = await fetch(`/api/journal/results/${entryId}`);
            if (!resp.ok) return; // keep polling

            const data = await resp.json();

            if (data.status === 'completed') {
                clearInterval(this.pollInterval);
                this._setProgress(100, 'Analysis complete!', '');
                this._completeAllSteps();
                this.lastResults = data;
                setTimeout(() => this._showResults(data), 600);

            } else if (data.status === 'failed') {
                clearInterval(this.pollInterval);
                this._toast(`Analysis failed: ${data.error || 'Unknown error'}`, 'error');
                this._showSection('capture');
            }
            // status === 'processing' → keep polling
        } catch (err) {
            // Network hiccup — keep trying
            console.warn('Poll error:', err);
        }
    }

    /* ── Display Results ─────────────────────────────────── */
    _showResults(data) {
        this._showSection('results');
        this.displayEmotionAnalysis(data.emotion_analysis || {});
        this.displaySentimentAnalysis(data.sentiment_analysis || {});
        this.displayTranscript(data.transcription || {});
        this.displayWellnessSummary(data.wellness_summary || {});
    }

    displayEmotionAnalysis(d) {
        const dominant   = (d.dominant_emotion || 'neutral').toLowerCase();
        const intensity  = Math.round((d.emotional_intensity || 0) * 100);
        const dist       = d.emotion_distribution || {};
        const timeline   = d.emotion_timeline || [];
        const meta       = emotionMeta(dominant);

        // Icon + label
        document.getElementById('ej-dominant-emoji').textContent = meta.emoji;
        document.getElementById('ej-dominant-label').textContent = dominant;
        const chip = document.getElementById('ej-intensity-chip');
        chip.textContent = `${intensity}% intensity`;
        chip.style.background   = meta.bg;
        chip.style.color        = meta.fg;
        chip.style.borderColor  = meta.bar;

        // Distribution bars
        const listEl = document.getElementById('ej-emotion-dist');
        listEl.innerHTML = '';
        const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);
        sorted.forEach(([em, pct]) => {
            const m = emotionMeta(em);
            const pctPct = Math.round(pct * 100);
            listEl.innerHTML += `
                <div class="ej-dist-row">
                    <span class="ej-dist-label">${em}</span>
                    <div class="ej-dist-track">
                        <div class="ej-dist-fill" style="width:${pctPct}%; background:${m.bar};"></div>
                    </div>
                    <span class="ej-dist-pct">${pctPct}%</span>
                </div>`;
        });

        // Trigger fill animation after paint
        requestAnimationFrame(() => {
            document.querySelectorAll('.ej-dist-fill').forEach(el => {
                el.style.width = el.style.width; // force reflow
            });
        });

        // Timeline
        if (timeline.length > 0) {
            document.getElementById('ej-emotion-timeline-wrap').style.display = 'block';
            const grid = document.getElementById('ej-timeline-grid');
            grid.innerHTML = '';
            timeline.forEach(row => {
                const m = emotionMeta(row.emotion);
                const conf = Math.round((row.confidence || 0) * 100);
                grid.innerHTML += `
                    <div class="ej-timeline-row">
                        <span class="ej-timeline-ts">${row.timestamp_seconds}s</span>
                        <span class="ej-timeline-chip"
                              style="background:${m.bg}; color:${m.fg}; border-color:${m.bar};">
                            ${row.emotion}
                        </span>
                        <div class="ej-timeline-bar-wrap">
                            <div class="ej-timeline-bar"
                                 style="width:${conf}%; background:${m.bar};"></div>
                        </div>
                        <span class="ej-timeline-conf">${conf}%</span>
                    </div>`;
            });
        }
    }

    displaySentimentAnalysis(d) {
        const score    = d.sentiment_score ?? 0;
        const overall  = (d.overall_sentiment || 'neutral').toLowerCase();
        const dist     = d.distribution || {};
        const phrases  = d.key_phrases  || [];

        // Gauge
        const gauge = document.getElementById('ej-sentiment-gauge');
        const absScore = Math.abs(score);
        let gaugeColor;
        if (overall === 'positive') gaugeColor = '#3ac47d';
        else if (overall === 'negative') gaugeColor = '#e07a5f';
        else gaugeColor = '#a0a4a8';

        // Conic-gradient gauge
        const deg = Math.round((absScore / 1.0) * 180);
        gauge.style.background =
            `conic-gradient(${gaugeColor} 0deg, ${gaugeColor} ${deg}deg, var(--bg-alt) ${deg}deg)`;

        document.getElementById('ej-gauge-score').textContent =
            (score >= 0 ? '+' : '') + score.toFixed(2);
        document.getElementById('ej-sentiment-label').textContent = overall;
        document.getElementById('ej-sentiment-label').style.color = gaugeColor;

        // Distribution pills
        const distEl = document.getElementById('ej-sent-dist');
        distEl.innerHTML = '';
        const pillClass = { positive: 'ej-sent-pill--pos', neutral: 'ej-sent-pill--neu', negative: 'ej-sent-pill--neg' };
        ['positive', 'neutral', 'negative'].forEach(k => {
            const v = Math.round((dist[k] || 0) * 100);
            distEl.innerHTML +=
                `<span class="ej-sent-pill ${pillClass[k] || ''}">${k} ${v}%</span>`;
        });

        // Key phrases
        if (phrases.length > 0) {
            document.getElementById('ej-phrases-wrap').style.display = 'block';
            const tagsEl = document.getElementById('ej-phrase-tags');
            tagsEl.innerHTML = phrases.map(p =>
                `<span class="ej-phrase-tag">${p}</span>`
            ).join('');
        }
    }

    displayTranscript(d) {
        const text     = (d.full_transcript || '').trim();
        const lang     = d.language || 'unknown';
        const segments = d.segments || [];

        document.getElementById('ej-transcript-lang').textContent =
            `Detected language: ${lang.toUpperCase()}`;

        const body = document.getElementById('ej-transcript-body');
        if (text) {
            body.innerHTML = text
                .split('\n')
                .filter(l => l.trim())
                .map(l => `<p>${this._escHtml(l)}</p>`)
                .join('');
        } else {
            body.innerHTML = '<span class="ej-transcript-empty">No speech detected in this video.</span>';
        }

        if (segments.length > 0) {
            document.getElementById('ej-segments-wrap').style.display = 'block';
            const list = document.getElementById('ej-segment-list');
            list.innerHTML = '';
            segments.forEach(seg => {
                const start = this._fmtSec(seg.start_time);
                const end   = this._fmtSec(seg.end_time);
                list.innerHTML += `
                    <div class="ej-segment-row">
                        <span class="ej-segment-time">${start} → ${end}</span>
                        <span class="ej-segment-text">${this._escHtml(seg.text || '')}</span>
                    </div>`;
            });
        }
    }

    displayWellnessSummary(d) {
        const state    = d.state    || 'Neutral';
        const indicator= d.indicator|| '';
        const recs     = d.recommendations || [];

        const stateBox = document.getElementById('ej-wellness-state-box');
        const icon     = document.getElementById('ej-wellness-icon');
        const nameEl   = document.getElementById('ej-wellness-name');
        const indEl    = document.getElementById('ej-wellness-indicator');

        nameEl.textContent = state;
        indEl.textContent  = indicator;

        // Remove old variant classes
        stateBox.className = 'ej-wellness-state';
        if (/distress/i.test(state)) {
            stateBox.classList.add('ej-wellness-state--distressed');
            icon.textContent = '⚠️';
        } else if (/positive/i.test(state)) {
            stateBox.classList.add('ej-wellness-state--positive');
            icon.textContent = '✅';
        } else {
            icon.textContent = 'ℹ️';
        }

        const list = document.getElementById('ej-recs-list');
        list.innerHTML = '';
        if (recs.length === 0) {
            list.innerHTML = '<li>Keep journaling regularly — consistency is powerful.</li>';
        } else {
            recs.forEach(rec => {
                list.innerHTML += `<li>${this._escHtml(rec)}</li>`;
            });
        }
    }

    /* ── Save entry to localStorage ─────────────────────── */
    saveEntry() {
        if (!this.lastResults) {
            this._toast('No results to save yet.', 'error');
            return;
        }
        const entries = JSON.parse(localStorage.getItem('ej-entries') || '[]');
        entries.unshift({
            id:          this.lastResults.entry_id || Date.now().toString(),
            saved_at:    new Date().toISOString(),
            wellness:    this.lastResults.wellness_summary,
            emotion:     this.lastResults.emotion_analysis,
            sentiment:   this.lastResults.sentiment_analysis,
            transcript:  this.lastResults.transcription,
        });
        localStorage.setItem('ej-entries', JSON.stringify(entries));
        renderHistory();   // refresh Past Entries section immediately
        this._toast('✅ Entry saved successfully!', 'success');
        document.getElementById('ej-btn-save').disabled = true;
        document.getElementById('ej-btn-save').textContent = '💾 Saved';
    }

    /* ── Reset ───────────────────────────────────────────── */
    resetAll() {
        // Stop camera
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(t => t.stop());
            this.cameraStream = null;
        }
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this._stopTimer();

        this.recordedBlob = null;
        this.uploadedFile = null;
        this.lastResults  = null;
        this.pollAttempts = 0;
        this.progressStageIdx = 0;

        this.elVideoPreview.srcObject = null;
        this.elVideoPreview.src = '';
        this.elVideoPreview.style.display    = 'none';
        this.elVideoPlaceholder.style.display = 'flex';
        this.elPlaybackCard.style.display     = 'none';
        this.elPlaybackVideo.src              = '';
        this.elFileInput.value                = '';

        this.elBtnCamera.style.display  = 'inline-flex';
        this.elBtnRecord.style.display  = 'none';
        this.elBtnStop.style.display    = 'none';
        this.elBtnRetake.style.display  = 'none';
        this.elRecordingTimer.classList.remove('active');

        // Reset progress
        this._setProgress(0, '', '');
        document.querySelectorAll('.ej-step').forEach(s => {
            s.classList.remove('active', 'done');
        });

        // Reset results UI
        document.getElementById('ej-btn-save').disabled = false;
        document.getElementById('ej-btn-save').textContent = '💾 Save Entry';

        this._showSection('capture');
        this._setAnalyzeReady(false);
    }

    /* ── UI helpers ──────────────────────────────────────── */
    _showSection(name) {
        this.elCaptureSection.style.display    = name === 'capture'    ? 'block' : 'none';
        this.elProcessingSection.classList.toggle('visible', name === 'processing');
        this.elResultsSection.classList.toggle('visible',    name === 'results');
    }

    _setAnalyzeReady(ready) {
        this.elBtnAnalyze.disabled = !ready;
        this.elReadyHint.textContent = ready
            ? 'Video ready. Click "Analyse Emotions" to begin.'
            : 'Record or upload a video to enable analysis.';
    }

    _setProgress(pct, label, sub) {
        if (this.elProgressFill) this.elProgressFill.style.width = `${pct}%`;
        if (this.elProgressPct)  this.elProgressPct.textContent  = `${pct}%`;
        if (label && this.elProcessLabel) this.elProcessLabel.textContent = label;
        if (sub   && this.elProcessSub)   this.elProcessSub.textContent   = sub;
    }

    _activateStep(stepKey) {
        const map = {
            upload:     'ej-step-upload',
            emotion:    'ej-step-emotion',
            transcript: 'ej-step-transcript',
            sentiment:  'ej-step-sentiment',
            wellness:   'ej-step-wellness',
        };
        const keys = Object.keys(map);
        const targetIdx = keys.indexOf(stepKey);
        keys.forEach((k, i) => {
            const el = document.getElementById(map[k]);
            if (!el) return;
            if (i < targetIdx)  { el.classList.remove('active'); el.classList.add('done'); }
            else if (i === targetIdx) { el.classList.add('active'); el.classList.remove('done'); }
            else { el.classList.remove('active', 'done'); }
        });
    }

    _completeAllSteps() {
        document.querySelectorAll('.ej-step').forEach(el => {
            el.classList.remove('active');
            el.classList.add('done');
        });
    }

    _toggleTimeline() {
        const grid = document.getElementById('ej-timeline-grid');
        const btn  = document.getElementById('ej-timeline-toggle');
        if (!grid) return;
        const visible = grid.style.display !== 'none';
        grid.style.display = visible ? 'none' : 'flex';
        btn.textContent = visible
            ? '▾ Show frame-by-frame timeline'
            : '▴ Hide timeline';
    }

    /* ── Timer ───────────────────────────────────────────── */
    _startTimer() {
        this.timerSeconds = 0;
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            this.elTimerDisplay.textContent = this._formatTime(this.timerSeconds);
        }, 1000);
    }

    _stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    _formatTime(s) {
        const m = Math.floor(s / 60);
        const ss = String(s % 60).padStart(2, '0');
        return `${m}:${ss}`;
    }

    /* ── Toast ───────────────────────────────────────────── */
    _toast(msg, type = 'info') {
        const el = document.createElement('div');
        el.className = `ej-toast ej-toast--${type}`;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(8px)';
            el.style.transition = 'all 0.3s ease';
            setTimeout(() => el.remove(), 320);
        }, 3500);
    }

    /* ── Utilities ───────────────────────────────────────── */
    _escHtml(str) { return _escHtml(str); }  // delegates to module-level fn

    _fmtSec(secs) {
        const s = Math.round(secs || 0);
        const m = Math.floor(s / 60);
        return `${m}:${String(s % 60).padStart(2, '0')}`;
    }
}

/* ── Bootstrap ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    const app = new EmotionJournal();

    // Stop camera if user navigates away
    window.addEventListener('beforeunload', () => {
        if (app.cameraStream) {
            app.cameraStream.getTracks().forEach(t => t.stop());
        }
    });

    // Render saved history immediately on page load
    renderHistory();

    // Clear-all button
    document.getElementById('ej-btn-clear-history').addEventListener('click', () => {
        if (!confirm('Delete all saved journal entries? This cannot be undone.')) return;
        localStorage.removeItem('ej-entries');
        renderHistory();
    });
});

/* ════════════════════════════════════════════════════════════
   History helpers  (module-level so saveEntry can call them)
   ════════════════════════════════════════════════════════════ */

const STATE_ICON = {
    'Distressed': '⚠️',
    'Low Mood':   '🔵',
    'Positive':   '✅',
    'Neutral':    'ℹ️',
};

function renderHistory() {
    const entries = JSON.parse(localStorage.getItem('ej-entries') || '[]');
    const grid  = document.getElementById('ej-history-grid');
    const empty = document.getElementById('ej-history-empty');

    grid.innerHTML = '';

    if (!entries.length) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    entries.forEach((entry, idx) => {
        const card = _buildHistoryCard(entry, idx);
        grid.appendChild(card);
    });
}

function _buildHistoryCard(entry, idx) {
    const wellness   = entry.wellness   || {};
    const emotion    = entry.emotion    || {};
    const sentiment  = entry.sentiment  || {};
    const transcript = entry.transcript || {};

    const state      = wellness.state || 'Neutral';
    const icon       = STATE_ICON[state] || 'ℹ️';
    const dominant   = (emotion.dominant_emotion  || 'neutral').toLowerCase();
    const intensity  = Math.round((emotion.emotional_intensity || 0) * 100);
    const sentLabel  = (sentiment.overall_sentiment || 'neutral').toLowerCase();
    const sentScore  = (sentiment.sentiment_score  ?? 0).toFixed(2);
    const fullText   = (transcript.full_transcript || '').trim();
    const lang       = (transcript.language || '').toUpperCase();
    const recs       = wellness.recommendations || [];
    const savedAt    = entry.saved_at
        ? new Date(entry.saved_at).toLocaleString(undefined, {
              month: 'short', day: 'numeric',
              year: 'numeric', hour: '2-digit', minute: '2-digit',
          })
        : '—';

    const eMeta = EMOTION_META[dominant] || EMOTION_META.neutral;

    const recsHtml = recs.map(r =>
        `<div class="ej-history-rec">${_escHtml(r)}</div>`
    ).join('');

    const card = document.createElement('div');
    card.className = 'ej-history-card';
    card.innerHTML = `
        <div class="ej-history-card-header">
            <span class="ej-history-state-badge">${icon}</span>
            <div class="ej-history-meta">
                <div class="ej-history-date">${savedAt}</div>
                <div class="ej-history-state-name">${_escHtml(state)}</div>
            </div>
            <button class="ej-history-delete-btn" data-idx="${idx}" title="Delete entry">🗑</button>
        </div>

        <div class="ej-history-pills">
            <span class="ej-history-pill"
                  style="background:${eMeta.bg}; color:${eMeta.fg}; border-color:${eMeta.bar};">
                ${eMeta.emoji} ${dominant} · ${intensity}%
            </span>
            <span class="ej-history-pill">
                💬 ${sentLabel} (${sentScore >= 0 ? '+' : ''}${sentScore})
            </span>
            ${lang ? `<span class="ej-history-pill">🌐 ${lang}</span>` : ''}
        </div>

        ${fullText
            ? `<div class="ej-history-transcript">"${_escHtml(fullText)}"</div>`
            : ''}

        <button class="ej-history-toggle" data-open="false">
            <span class="ej-toggle-arrow">▾</span> Show details
        </button>

        <div class="ej-history-detail">
            <div class="ej-history-detail-row">
                ${recs.length ? `
                    <div>
                        <div class="ej-history-section-label">Recommendations</div>
                        ${recsHtml}
                    </div>` : ''}
                ${fullText ? `
                    <div>
                        <div class="ej-history-section-label">Transcript</div>
                        <div style="font-size:0.83rem; color:var(--text-secondary);
                                    line-height:1.6; background:var(--surface);
                                    padding:0.6rem 0.85rem; border-radius:var(--radius-sm);">
                            ${_escHtml(fullText)}
                        </div>
                    </div>` : ''}
            </div>
        </div>
    `;

    // Toggle expand
    card.querySelector('.ej-history-toggle').addEventListener('click', function () {
        const detail = this.nextElementSibling;
        const isOpen = this.dataset.open === 'true';
        this.dataset.open = String(!isOpen);
        this.querySelector('.ej-toggle-arrow').textContent = isOpen ? '▾' : '▴';
        this.textContent = '';
        this.innerHTML = `<span class="ej-toggle-arrow">${isOpen ? '▾' : '▴'}</span> ${isOpen ? 'Show' : 'Hide'} details`;
        detail.classList.toggle('open', !isOpen);
    });

    // Delete entry
    card.querySelector('.ej-history-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const i = parseInt(e.currentTarget.dataset.idx, 10);
        const entries = JSON.parse(localStorage.getItem('ej-entries') || '[]');
        entries.splice(i, 1);
        localStorage.setItem('ej-entries', JSON.stringify(entries));
        renderHistory();
    });

    return card;
}

function _escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
