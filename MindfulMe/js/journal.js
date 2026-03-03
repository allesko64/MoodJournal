class Journal {
    constructor() {
        this.entries = [];
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.recordedBlob = null;
        this.cameraStream = null;
        this.initializeEventListeners();
        this.fetchEntries();
    }

    async fetchEntries() {
        try {
            const data = await ApiClient.get('/api/journals');
            this.entries = data.entries || [];
            this.renderEntries();
        } catch (error) {
            console.error('Error fetching journals:', error);
            // Fallback to local storage if backend is not running
            this.entries = Storage.get('journalEntries', []) || [];
            this.renderEntries();
        }
    }

    initializeEventListeners() {
        document.getElementById('new-entry').addEventListener('click', () => {
            const form = document.querySelector('.journal-entry-form');
            const button = document.getElementById('new-entry');

            if (form.classList.contains('active')) {
                form.classList.remove('active');
                button.textContent = 'New Entry';
                this.resetForm();
            } else {
                form.classList.add('active');
                button.textContent = 'Close';
            }
        });

        // Save entry
        document.getElementById('save-entry').addEventListener('click', async () => {
            const saved = await this.saveEntry();
            if (saved) {
                document.querySelector('.journal-entry-form').classList.remove('active');
                document.getElementById('new-entry').textContent = 'New Entry';
                this.stopCamera();
            }
        });

        document.getElementById('cancel-entry').addEventListener('click', () => {
            document.querySelector('.journal-entry-form').classList.remove('active');
            document.getElementById('new-entry').textContent = 'New Entry';
            this.resetForm();
            this.stopCamera();
        });

        document.querySelector('.journal-filters input').addEventListener('input', (e) => {
            this.filterEntries(e.target.value);
        });

        document.querySelector('.journal-filters select').addEventListener('change', (e) => {
            this.sortEntries(e.target.value);
        });

        // Media Recording Listeners
        document.getElementById('start-camera').addEventListener('click', (e) => {
            e.preventDefault();
            this.startCamera();
        });

        document.getElementById('start-recording').addEventListener('click', (e) => {
            e.preventDefault();
            this.startRecording();
        });

        document.getElementById('stop-recording').addEventListener('click', (e) => {
            e.preventDefault();
            this.stopRecording();
        });

        document.getElementById('retake-video').addEventListener('click', (e) => {
            e.preventDefault();
            this.recordedBlob = null;
            document.getElementById('recording-playback-container').style.display = 'none';
            document.getElementById('camera-preview').style.display = 'block';
            document.getElementById('start-recording').style.display = 'inline-block';
        });
    }

    async startCamera() {
        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const preview = document.getElementById('camera-preview');
            preview.srcObject = this.cameraStream;
            preview.style.display = 'block';

            document.getElementById('start-camera').classList.add('recorder-btn-hidden');
            document.getElementById('start-recording').classList.remove('recorder-btn-hidden');
            document.getElementById('start-recording').classList.add('recorder-btn-visible');
        } catch (err) {
            console.error("Error accessing camera/mic:", err);
            alert("Could not access camera and microphone. Please check permissions.");
        }
    }

    startRecording() {
        if (!this.cameraStream) return;

        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(this.cameraStream, { mimeType: 'video/webm' });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            this.recordedBlob = new Blob(this.recordedChunks, {
                type: 'video/webm'
            });
            const videoUrl = URL.createObjectURL(this.recordedBlob);

            const playback = document.getElementById('recording-playback');
            playback.src = videoUrl;

            document.getElementById('camera-preview').classList.remove('recorder-btn-hidden');
            document.getElementById('recording-playback-container').classList.remove('recorder-playback-visible');
        };

        this.mediaRecorder.start();

        document.getElementById('start-recording').classList.add('recorder-btn-hidden');
        document.getElementById('start-recording').classList.remove('recorder-btn-visible');
        document.getElementById('stop-recording').classList.remove('recorder-btn-hidden');
        document.getElementById('stop-recording').classList.add('recorder-btn-visible');
        document.getElementById('recording-status').classList.add('recorder-status-visible');
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        document.getElementById('stop-recording').classList.add('recorder-btn-hidden');
        document.getElementById('stop-recording').classList.remove('recorder-btn-visible');
        document.getElementById('recording-status').classList.remove('recorder-status-visible');
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        const preview = document.getElementById('camera-preview');
        preview.srcObject = null;
        preview.style.display = 'none';

        document.getElementById('start-camera').classList.remove('recorder-btn-hidden');
        document.getElementById('start-recording').classList.add('recorder-btn-hidden');
        document.getElementById('start-recording').classList.remove('recorder-btn-visible');
        document.getElementById('stop-recording').classList.add('recorder-btn-hidden');
        document.getElementById('stop-recording').classList.remove('recorder-btn-visible');
        document.getElementById('recording-status').classList.remove('recorder-status-visible');
        document.getElementById('recording-playback-container').classList.remove('recorder-playback-visible');
        this.recordedBlob = null;
    }

    showSavingOverlay(visible) {
        const overlay = document.getElementById('saving-overlay');
        const saveBtn = document.getElementById('save-entry');
        if (visible) {
            overlay.style.display = 'flex';
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            this.setSavingProgress(0, 'Saving entry...');
        } else {
            overlay.style.display = 'none';
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    }

    setSavingProgress(percent, text) {
        const fill = document.getElementById('saving-progress-fill');
        const percentEl = document.getElementById('saving-percent');
        const textEl = document.querySelector('.saving-overlay__text');
        if (fill) fill.style.width = `${percent}%`;
        if (percentEl) percentEl.textContent = percent > 0 ? `${Math.round(percent)}%` : '';
        if (text && textEl) textEl.textContent = text;
    }

    uploadWithProgress(url, formData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url);

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const pct = (e.loaded / e.total) * 100;
                    const label = pct < 100 ? 'Uploading video...' : 'Processing on server...';
                    this.setSavingProgress(Math.min(pct, 99), label);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    this.setSavingProgress(100, 'Done!');
                    try { resolve(JSON.parse(xhr.responseText)); }
                    catch (e) { resolve(xhr.responseText); }
                } else {
                    const err = new Error(`Upload failed (${xhr.status})`);
                    err.status = xhr.status;
                    reject(err);
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
            xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

            xhr.send(formData);
        });
    }

    async saveEntry() {
        const title = document.getElementById('entry-title').value;
        const content = document.getElementById('entry-content').value;
        const tags = document.querySelector('.entry-tags input').value
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag)
            .join(',');

        if (!title || !content) {
            alert('Please fill in both title and content');
            return false;
        }

        const langSelect = document.getElementById('transcript-language');
        const language = langSelect ? langSelect.value : 'auto';

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('tags', tags);
        formData.append('language', language);
        if (this.recordedBlob) {
            formData.append('media_file', this.recordedBlob, 'recording.webm');
        }

        this.showSavingOverlay(true);

        try {
            if (this.recordedBlob) {
                await this.uploadWithProgress('http://localhost:8000/api/journal', formData);
            } else {
                this.setSavingProgress(50, 'Saving entry...');
                await ApiClient.postForm('/api/journal', formData);
            }
            this.setSavingProgress(100, 'Done!');
            await this.fetchEntries();
            this.resetForm();
            this.showSavingOverlay(false);
            document.querySelector('.journal-entry-form').classList.remove('active');
            document.getElementById('new-entry').textContent = 'New Entry';
            this.showToast('✅ Journal entry saved successfully!');
            return true;
        } catch (error) {
            console.error('Error saving journal:', error);
            this.showSavingOverlay(false);

            const entry = {
                id: Date.now(),
                title,
                content,
                tags: tags.split(',').filter(t => t),
                date: new Date().toISOString(),
                lastModified: new Date().toISOString()
            };
            this.entries.unshift(entry);
            Storage.set('journalEntries', this.entries);
            this.renderEntries();
            this.resetForm();
            this.showToast('✅ Entry saved locally (server offline)');
            return true;
        }
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        // These classes have pre-defined CSS keyframe animations (no style.setProperty needed)
        toast.className = 'toast-notification toast-auto toast-' + type;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    renderEntries() {
        const container = document.getElementById('journal-entries');
        container.innerHTML = '';

        this.entries.forEach(entry => {
            const entryElement = this.createEntryElement(entry);
            container.appendChild(entryElement);
        });
    }

    createEntryElement(entry) {
        const div = document.createElement('div');
        div.className = 'journal-entry';

        let mediaHtml = '';
        if (entry.media_file_path) {
            const mediaUrl = `http://localhost:8000/${entry.media_file_path}`;
            if (entry.media_file_path.toLowerCase().match(/\\.(mp4|webm|ogg)$/)) {
                mediaHtml = `<video src="${mediaUrl}" controls style="width: 100%; border-radius: 8px; margin-top: 10px;"></video>`;
            } else if (entry.media_file_path.toLowerCase().match(/\\.(mp3|wav|ogg)$/)) {
                mediaHtml = `<audio src="${mediaUrl}" controls style="width: 100%; margin-top: 10px;"></audio>`;
            } else {
                mediaHtml = `<p>Media attached: ${entry.media_file_path}</p>`;
            }
        }

        let tagsArray = [];
        if (typeof entry.tags === 'string') {
            tagsArray = entry.tags.split(',').filter(t => t);
        } else if (Array.isArray(entry.tags)) {
            tagsArray = entry.tags;
        }

        let transcriptSnippet = (entry.transcription || '').trim();
        const prefixMatch = transcriptSnippet.match(/^\[Translated from .+?\]\s*/);
        if (prefixMatch) transcriptSnippet = transcriptSnippet.slice(prefixMatch[0].length);
        const transcriptPreview = transcriptSnippet
            ? `${transcriptSnippet.substring(0, 120)}${transcriptSnippet.length > 120 ? '…' : ''}`
            : '';

        div.innerHTML = `
            <div class="entry-header">
                <h3>${entry.title || 'Untitled'}</h3>
                <button class="delete-entry-btn" title="Delete entry">🗑</button>
            </div>
            <p class="entry-date">${new Date((entry.date || '').replace(' ', 'T')).toLocaleDateString()}</p>
            <p class="entry-preview">${(entry.content || '').substring(0, 150)}${(entry.content || '').length > 150 ? '...' : ''}</p>
            ${mediaHtml}
            ${transcriptPreview ? `<p class="entry-transcript-preview"><strong>Transcript:</strong> ${transcriptPreview}</p>` : ''}
            <div class="entry-tags">
                ${tagsArray.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        `;

        // Open full view when clicking anywhere on the card except the delete button
        div.addEventListener('click', (e) => {
            if (e.target.tagName !== 'VIDEO' && e.target.tagName !== 'AUDIO' && !e.target.classList.contains('delete-entry-btn')) {
                this.showFullEntry(entry);
            }
        });

        // Delete button — two-click inline confirmation (no popup dialog)
        const deleteBtn = div.querySelector('.delete-entry-btn');
        let deleteReady = false;
        let deleteTimer = null;

        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!deleteReady) {
                // First click: turn red and ask to confirm
                deleteReady = true;
                deleteBtn.textContent = '✓';
                deleteBtn.classList.add('delete-confirm');
                deleteTimer = setTimeout(() => {
                    // Reset after 3s if no second click
                    deleteReady = false;
                    deleteBtn.textContent = '🗑';
                    deleteBtn.classList.remove('delete-confirm');
                }, 3000);
            } else {
                // Second click: actually delete
                clearTimeout(deleteTimer);
                await this.deleteEntry(entry.id, div);
            }
        });


        return div;
    }

    async deleteEntry(id, cardElement) {
        try {
            await ApiClient.delete(`/api/journal/${id}`);
            cardElement.remove();
            this.entries = this.entries.filter(e => e.id !== id);
            this.showToast('🗑 Entry deleted successfully');
        } catch (err) {
            console.error('Delete error:', err);
            this.showToast('Could not connect to server', 'error');
        }
    }

    getEmotionColor(emotion) {
        const colors = {
            happy:    { bg: 'rgba(58, 196, 125, 0.12)', fg: '#2d8a56', bar: '#3ac47d' },
            sad:      { bg: 'rgba(100, 149, 237, 0.12)', fg: '#3d6dba', bar: '#6495ed' },
            angry:    { bg: 'rgba(224, 122, 95, 0.12)',  fg: '#b85a3e', bar: '#e07a5f' },
            surprise: { bg: 'rgba(232, 184, 109, 0.12)', fg: '#b08430', bar: '#e8b86d' },
            fear:     { bg: 'rgba(162, 132, 194, 0.12)', fg: '#7b5ea0', bar: '#a284c2' },
            disgust:  { bg: 'rgba(130, 170, 110, 0.12)', fg: '#5a7a42', bar: '#82aa6e' },
            neutral:  { bg: 'rgba(160, 164, 168, 0.12)', fg: '#636e72', bar: '#a0a4a8' },
        };
        return colors[(emotion || '').toLowerCase()] || colors.neutral;
    }

    showFullEntry(entry) {
        const mainContainer = document.querySelector('.journal-container');
        mainContainer.style.display = 'none';

        let mediaHtml = '';
        if (entry.media_file_path) {
            const mediaUrl = `http://localhost:8000/${entry.media_file_path}`;
            if (entry.media_file_path.toLowerCase().match(/\\.(mp4|webm|ogg)$/)) {
                mediaHtml = `<video src="${mediaUrl}" controls class="full-entry-media"></video>`;
            } else if (entry.media_file_path.toLowerCase().match(/\\.(mp3|wav|ogg)$/)) {
                mediaHtml = `<audio src="${mediaUrl}" controls class="full-entry-media full-entry-media--audio"></audio>`;
            }
        }

        let tagsArray = [];
        if (typeof entry.tags === 'string') {
            tagsArray = entry.tags.split(',').filter(t => t);
        } else if (Array.isArray(entry.tags)) {
            tagsArray = entry.tags;
        }

        const rawTranscript = (entry.transcription || '').trim();
        let translatedFrom = '';
        let fullTranscript = rawTranscript;
        const langMatch = rawTranscript.match(/^\[Translated from (.+?)\]\s*/);
        if (langMatch) {
            translatedFrom = langMatch[1];
            fullTranscript = rawTranscript.slice(langMatch[0].length);
        }

        const fullEntryView = document.createElement('div');
        fullEntryView.className = 'full-entry-view';
        fullEntryView.innerHTML = `
            <div class="full-entry-content">
                <button class="back-btn">← Back to Journals</button>
                <h2>${entry.title || 'Untitled'}</h2>
                <p class="entry-date">${new Date((entry.date || '').replace(' ', 'T')).toLocaleDateString()}</p>
                <div class="entry-tags">
                    ${tagsArray.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                ${mediaHtml}
                <div class="entry-full-content">
                    ${(entry.content || '').split('\n').map(paragraph => `<p>${paragraph}</p>`).join('')}
                </div>
                <div class="insight-panel">
                    <div class="insight-panel__section insight-panel__transcript">
                        <div class="insight-panel__header">
                            <span class="insight-panel__icon">📝</span>
                            <h3>Transcript</h3>
                            ${translatedFrom ? `<span class="translated-badge">Translated from ${translatedFrom}</span>` : ''}
                        </div>
                        ${fullTranscript
                            ? `<div class="transcript-body">${fullTranscript.split('\\n').map(p => `<p>${p}</p>`).join('')}</div>`
                            : `<p class="transcript-empty">No transcript available for this entry.</p>`}
                    </div>
                    <div class="insight-panel__section insight-panel__emotions" data-entry-id="${entry.id}">
                        <div class="insight-panel__header">
                            <span class="insight-panel__icon">🧠</span>
                            <h3>Emotion Analysis</h3>
                        </div>
                        <p class="emotions-status">Loading emotion data...</p>
                        <div class="emotions-content"></div>
                    </div>
                    <div class="insight-panel__section insight-panel__ai-insights" data-entry-id="${entry.id}">
                        <div class="insight-panel__header">
                            <span class="insight-panel__icon">✨</span>
                            <h3>AI Insights</h3>
                        </div>
                        <div class="ai-insights-content"></div>
                        <button class="ai-insights-btn">Get AI Insights</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(fullEntryView);

        const backBtn = fullEntryView.querySelector('.back-btn');
        backBtn.addEventListener('click', () => {
            fullEntryView.remove();
            mainContainer.style.display = 'block';
        });

        const emotionsSection = fullEntryView.querySelector('.insight-panel__emotions');
        if (entry.id && emotionsSection) {
            this.loadEmotions(entry.id, emotionsSection);
        } else if (emotionsSection) {
            const statusEl = emotionsSection.querySelector('.emotions-status');
            if (statusEl) statusEl.textContent = 'Emotion data is unavailable for this locally saved entry.';
        }

        const insightsSection = fullEntryView.querySelector('.insight-panel__ai-insights');
        if (entry.id && insightsSection) {
            this.initInsightsButton(entry.id, insightsSection);
        }
    }

    async loadEmotions(entryId, sectionEl) {
        const statusEl = sectionEl.querySelector('.emotions-status');
        const contentEl = sectionEl.querySelector('.emotions-content');

        if (!statusEl || !contentEl) return;

        try {
            const data = await ApiClient.get(`/api/journal/${entryId}/emotions`);
            const emotions = data.emotions || [];

            if (!emotions.length) {
                statusEl.textContent = 'No emotion data stored for this entry.';
                contentEl.innerHTML = '';
                return;
            }

            statusEl.textContent = '';

            const audioLogs = emotions.filter(e => (e.source || '').toLowerCase() === 'audio');
            const videoLogs = emotions.filter(e => (e.source || '').toLowerCase() === 'video');

            let html = '';

            if (audioLogs.length) {
                const topAudio = audioLogs[0];
                const confPct = (topAudio.confidence_score * 100).toFixed(1);
                const clr = this.getEmotionColor(topAudio.detected_emotion);
                html += `
                    <div class="emotion-card">
                        <div class="emotion-card__badge" style="background:${clr.bg}; color:${clr.fg}">Voice</div>
                        <h4 class="emotion-card__title">Detected Voice Emotion</h4>
                        <div class="emotion-card__primary">
                            <span class="emotion-chip" style="background:${clr.bg}; color:${clr.fg}; border-color:${clr.bar}">${topAudio.detected_emotion}</span>
                        </div>
                        <div class="confidence-gauge">
                            <div class="confidence-gauge__label">Confidence</div>
                            <div class="confidence-gauge__track">
                                <div class="confidence-gauge__fill" style="width:${confPct}%; background:${clr.bar}"></div>
                            </div>
                            <div class="confidence-gauge__value">${confPct}%</div>
                        </div>
                    </div>
                `;
            }

            if (videoLogs.length) {
                const stats = {};
                let totalSamples = 0;

                videoLogs.forEach(log => {
                    const emotion = (log.detected_emotion || 'Unknown').trim();
                    const conf = typeof log.confidence_score === 'number' ? log.confidence_score : 0;
                    if (!stats[emotion]) {
                        stats[emotion] = { count: 0, totalConf: 0 };
                    }
                    stats[emotion].count += 1;
                    stats[emotion].totalConf += conf;
                    totalSamples += 1;
                });

                const summary = Object.entries(stats).map(([emotion, d]) => {
                    const count = d.count || 0;
                    const avgConf = count ? d.totalConf / count : 0;
                    const share = totalSamples ? (count / totalSamples) * 100 : 0;
                    return { emotion, count, avgConf, share };
                }).sort((a, b) => b.share !== a.share ? b.share - a.share : b.avgConf - a.avgConf);

                const dominant = summary[0];
                const domClr = this.getEmotionColor(dominant.emotion);

                const distributionBars = summary.map(s => {
                    const c = this.getEmotionColor(s.emotion);
                    return `
                        <div class="distrib-row">
                            <span class="distrib-row__label">${s.emotion}</span>
                            <div class="distrib-row__track">
                                <div class="distrib-row__fill" style="width:${s.share.toFixed(1)}%; background:${c.bar}"></div>
                            </div>
                            <span class="distrib-row__pct">${s.share.toFixed(0)}%</span>
                            <span class="distrib-row__conf" title="Average confidence">${(s.avgConf * 100).toFixed(0)}% conf</span>
                        </div>
                    `;
                }).join('');

                const duration = videoLogs.length > 0
                    ? videoLogs[videoLogs.length - 1].timestamp_seconds.toFixed(1)
                    : '0';

                const timelineRows = videoLogs.map(log => {
                    const c = this.getEmotionColor(log.detected_emotion);
                    return `
                        <div class="timeline-row">
                            <span class="timeline-row__time">${log.timestamp_seconds.toFixed(1)}s</span>
                            <span class="timeline-row__chip" style="background:${c.bg}; color:${c.fg}; border-color:${c.bar}">${log.detected_emotion}</span>
                            <div class="timeline-row__bar-wrap">
                                <div class="timeline-row__bar" style="width:${(log.confidence_score * 100).toFixed(1)}%; background:${c.bar}"></div>
                            </div>
                            <span class="timeline-row__conf">${(log.confidence_score * 100).toFixed(0)}%</span>
                        </div>
                    `;
                }).join('');

                html += `
                    <div class="emotion-card emotion-card--wide">
                        <div class="emotion-card__badge" style="background:${domClr.bg}; color:${domClr.fg}">Video</div>
                        <h4 class="emotion-card__title">Facial Emotion Analysis</h4>
                        <div class="emotion-card__stats-row">
                            <div class="stat-box">
                                <span class="stat-box__value">${totalSamples}</span>
                                <span class="stat-box__label">Samples</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-box__value">${duration}s</span>
                                <span class="stat-box__label">Duration</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-box__value" style="color:${domClr.fg}">${dominant.emotion}</span>
                                <span class="stat-box__label">Dominant</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-box__value">${summary.length}</span>
                                <span class="stat-box__label">Emotions</span>
                            </div>
                        </div>

                        <h5 class="emotion-card__sub">Emotion Distribution</h5>
                        <div class="distrib-chart">${distributionBars}</div>

                        <details class="timeline-details">
                            <summary class="timeline-details__toggle">
                                Frame-by-frame timeline <span class="timeline-details__count">(${videoLogs.length} frames)</span>
                            </summary>
                            <div class="timeline-grid">${timelineRows}</div>
                        </details>
                    </div>
                `;
            }

            contentEl.innerHTML = html || '<p class="transcript-empty">No detailed emotion data available.</p>';
        } catch (error) {
            console.error('Error loading emotions:', error);
            statusEl.textContent = 'Could not load emotion data (server offline or unavailable).';
            contentEl.innerHTML = '';
        }
    }

    initInsightsButton(entryId, sectionEl) {
        const btn = sectionEl.querySelector('.ai-insights-btn');
        const contentEl = sectionEl.querySelector('.ai-insights-content');
        if (!btn || !contentEl) return;

        btn.addEventListener('click', () => this.loadInsights(entryId, btn, contentEl, false));
    }

    async loadInsights(entryId, btn, contentEl, refresh) {
        btn.disabled = true;
        btn.textContent = 'Generating...';
        contentEl.innerHTML = '<p class="ai-insights-loading">Analyzing your entry with AI...</p>';

        try {
            const url = `/api/journal/${entryId}/insights${refresh ? '?refresh=true' : ''}`;
            const data = await ApiClient.get(url);
            const text = (data.insights || '').trim();

            if (!text) {
                contentEl.innerHTML = '<p class="transcript-empty">No insights could be generated.</p>';
                btn.textContent = 'Retry';
                btn.disabled = false;
                return;
            }

            const formatted = text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, "<br>");

            contentEl.innerHTML = `
                <div class="ai-insights-card">
                    <div class="ai-insights-body">${formatted}</div>
                    ${data.cached ? '<span class="ai-insights-cached">cached</span>' : ''}
                </div>
            `;
            btn.textContent = 'Refresh Insights';
            btn.disabled = false;
            btn.onclick = () => this.loadInsights(entryId, btn, contentEl, true);
        } catch (error) {
            console.error('Error loading insights:', error);
            contentEl.innerHTML = '<p class="transcript-empty">Could not generate insights (server offline or unavailable).</p>';
            btn.textContent = 'Retry';
            btn.disabled = false;
        }
    }

    filterEntries(searchTerm) {
        const filtered = this.entries.filter(entry =>
            (entry.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (entry.content || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (Array.isArray(entry.tags) ? entry.tags : []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        this.renderFilteredEntries(filtered);
    }

    sortEntries(sortMethod) {
        const sorted = [...this.entries];
        if (sortMethod === 'oldest') {
            sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
        } else {
            sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        this.renderFilteredEntries(sorted);
    }

    renderFilteredEntries(entries) {
        const container = document.getElementById('journal-entries');
        container.innerHTML = '';
        entries.forEach(entry => {
            const entryElement = this.createEntryElement(entry);
            container.appendChild(entryElement);
        });
    }

    resetForm() {
        document.getElementById('entry-title').value = '';
        document.getElementById('entry-content').value = '';
        document.querySelector('.entry-tags input').value = '';
        this.stopCamera();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const journalApp = new Journal();

    // Ensure camera turns off if the user navigates away from the page
    window.addEventListener('beforeunload', () => {
        journalApp.stopCamera();
    });
});
