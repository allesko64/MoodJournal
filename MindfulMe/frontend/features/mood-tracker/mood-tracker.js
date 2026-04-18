class MoodTracker {
    constructor() {
        this.moodData = Storage.get('moodData', []) || [];
        
        // Force refresh data to the new requested April 16-23 set, but only once
        if (!Storage.get('demoDataSeeded_April16_23')) {
            this.moodData = [];
            this.seedSampleData();
            Storage.set('demoDataSeeded_April16_23', true);
        } else if (this.moodData.length === 0) {
            this.seedSampleData();
        }

        this.initializeEventListeners();
        this.renderMoodHistory();
        this.renderEntriesList();
    }

    seedSampleData() {
        const sampleEntries = [
            { date: '2026-04-16T10:00:00.000Z', mood: 'good', factors: ['exercise', 'nutrition'], notes: 'Morning yoga and a healthy breakfast. Feeling energized for the day.' },
            { date: '2026-04-17T18:30:00.000Z', mood: 'okay', factors: ['stress'], notes: 'Work was very demanding today. Getting a bit overwhelmed.' },
            { date: '2026-04-18T20:15:00.000Z', mood: 'great', factors: ['social', 'exercise'], notes: 'Long hike with friends! The weather was beautiful, feeling amazing.' },
            { date: '2026-04-19T09:45:00.000Z', mood: 'bad', factors: ['sleep', 'stress'], notes: 'Barely slept last night. Anxious about the upcoming presentation.' },
            { date: '2026-04-20T14:20:00.000Z', mood: 'good', factors: ['social'], notes: 'Connected with a mentor. Feeling much more confident and focused.' },
            { date: '2026-04-21T17:00:00.000Z', mood: 'great', factors: ['social', 'nutrition'], notes: 'Tried a new healthy recipe and had dinner with family. Lots of laughs.' },
            { date: '2026-04-22T21:30:00.000Z', mood: 'good', factors: ['sleep'], notes: 'Caught up on sleep. Finally feeling my physical energy return.' },
            { date: '2026-04-23T16:45:00.000Z', mood: 'great', factors: ['social', 'exercise'], notes: 'Presentation went perfectly! Feeling proud and relieved.' }
        ];

        sampleEntries.forEach(s => {
            this.moodData.push({
                date: s.date,
                mood: s.mood,
                factors: s.factors,
                notes: s.notes
            });
        });

        Storage.set('moodData', this.moodData);
    }

    initializeEventListeners() {
        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectMood(btn));
        });
        document.getElementById('save-mood').addEventListener('click', () => this.saveMoodEntry());
    }

    selectMood(button) {
        document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
    }

    saveMoodEntry() {
        const selectedMood = document.querySelector('.mood-btn.active')?.dataset.mood;
        const factors = Array.from(document.querySelectorAll('.factors-grid input:checked')).map(input => input.value);
        const notes = document.querySelector('.mood-notes textarea').value;

        if (!selectedMood) {
            alert('Please select a mood');
            return;
        }

        const entry = {
            date: new Date().toISOString(),
            mood: selectedMood,
            factors: factors,
            notes: notes
        };

        this.moodData.push(entry);
        Storage.set('moodData', this.moodData);
        this.renderMoodHistory();
        this.renderEntriesList();
        this.resetForm();
    }

    renderMoodHistory() {
        const canvas = document.getElementById('mood-chart');
        const ctx = canvas.getContext('2d');

        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const moodValues = { 'great': 5, 'good': 4, 'okay': 3, 'bad': 2, 'terrible': 1 };
        const recentEntries = this.moodData.slice(-7);

        const padding = 40;
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - (padding * 2);

        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#5B8A72';

        ctx.strokeStyle = '#E8E2D9';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = padding + (i * (chartHeight / 4));
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(canvas.width - padding, y);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.strokeStyle = '#E8E2D9';
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();

        if (recentEntries.length > 0) {
            const pointSpacing = chartWidth / (recentEntries.length - 1 || 1);

            const points = recentEntries.map((entry, index) => ({
                x: padding + (index * pointSpacing),
                y: canvas.height - padding - ((moodValues[entry.mood] - 1) * (chartHeight / 4))
            }));

            ctx.beginPath();
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            points.forEach((pt, i) => {
                if (i === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            });
            ctx.stroke();

            points.forEach(pt => {
                ctx.beginPath();
                ctx.fillStyle = '#FFFFFF';
                ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.strokeStyle = primaryColor;
                ctx.lineWidth = 2.5;
                ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
                ctx.stroke();
            });

            recentEntries.forEach((entry, index) => {
                const x = points[index].x;
                ctx.fillStyle = '#636E72';
                ctx.font = '11px Inter, sans-serif';
                ctx.textAlign = 'center';
                const d = new Date(entry.date);
                const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                ctx.fillText(dateLabel, x, canvas.height - padding + 20);
            });
        }

        ctx.fillStyle = '#636E72';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';
        ['Great', 'Good', 'Okay', 'Bad', 'Terrible'].forEach((label, index) => {
            const y = padding + (index * (chartHeight / 4));
            ctx.fillText(label, padding - 10, y + 5);
        });
    }

    renderEntriesList() {
        const container = document.getElementById('mood-entries-list');
        if (!container) return;

        if (this.moodData.length === 0) {
            container.innerHTML = '<p class="mood-empty-msg">No entries yet. Log your first mood above!</p>';
            return;
        }

        const moodEmoji = { great: '😊', good: '🙂', okay: '😐', bad: '😕', terrible: '😢' };
        const moodLabel = { great: 'Great', good: 'Good', okay: 'Okay', bad: 'Bad', terrible: 'Terrible' };
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const weeks = [];
        for (let w = 0; w < 4; w++) {
            const weekStart = new Date(startOfWeek);
            weekStart.setDate(weekStart.getDate() - (w * 7));
            const days = [];
            for (let d = 0; d < 7; d++) {
                const cellDate = new Date(weekStart);
                cellDate.setDate(weekStart.getDate() + d);
                const entry = this.moodData.find(e => {
                    const ed = new Date(e.date);
                    return ed.getFullYear() === cellDate.getFullYear() &&
                           ed.getMonth() === cellDate.getMonth() &&
                           ed.getDate() === cellDate.getDate();
                });
                days.push({ date: cellDate, entry: entry || null });
            }
            weeks.push(days);
        }
        weeks.reverse();

        const headerCells = dayNames.map(n => `<div class="mood-grid__day-label">${n}</div>`).join('');

        const weekRows = weeks.map(week => {
            const cells = week.map(({ date, entry }) => {
                const isToday = date.toDateString() === new Date().toDateString();
                const isFuture = date > new Date();
                const dayNum = date.getDate();

                if (isFuture) {
                    return `<div class="mood-grid__cell mood-grid__cell--future"><span class="mood-grid__date">${dayNum}</span></div>`;
                }
                if (!entry) {
                    return `<div class="mood-grid__cell mood-grid__cell--empty${isToday ? ' mood-grid__cell--today' : ''}"><span class="mood-grid__date">${dayNum}</span></div>`;
                }

                const tooltip = `${moodLabel[entry.mood]}${entry.notes ? ': ' + entry.notes : ''}`;
                return `<div class="mood-grid__cell mood-grid__cell--${entry.mood}${isToday ? ' mood-grid__cell--today' : ''}" title="${tooltip.replace(/"/g, '&quot;')}">
                    <span class="mood-grid__date">${dayNum}</span>
                    <span class="mood-grid__emoji">${moodEmoji[entry.mood] || ''}</span>
                </div>`;
            }).join('');
            return cells;
        }).join('');

        const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        container.innerHTML = `
            <div class="mood-grid">
                <div class="mood-grid__header">
                    <div class="mood-grid__month">${monthLabel}</div>
                    <div class="mood-grid__legend">
                        <span class="mood-grid__legend-item"><span class="mood-grid__legend-dot mood-grid__legend-dot--great"></span>Great</span>
                        <span class="mood-grid__legend-item"><span class="mood-grid__legend-dot mood-grid__legend-dot--good"></span>Good</span>
                        <span class="mood-grid__legend-item"><span class="mood-grid__legend-dot mood-grid__legend-dot--okay"></span>Okay</span>
                        <span class="mood-grid__legend-item"><span class="mood-grid__legend-dot mood-grid__legend-dot--bad"></span>Bad</span>
                        <span class="mood-grid__legend-item"><span class="mood-grid__legend-dot mood-grid__legend-dot--terrible"></span>Terrible</span>
                    </div>
                </div>
                <div class="mood-grid__days">${headerCells}</div>
                <div class="mood-grid__body">${weekRows}</div>
            </div>
        `;
    }

    resetForm() {
        document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.factors-grid input').forEach(input => { input.checked = false; });
        document.querySelector('.mood-notes textarea').value = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MoodTracker();
});
