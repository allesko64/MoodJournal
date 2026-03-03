class MoodTracker {
    constructor() {
        this.moodData = Storage.get('moodData', []) || [];
        if (this.moodData.length === 0) {
            this.seedSampleData();
        }
        this.initializeEventListeners();
        this.renderMoodHistory();
        this.renderEntriesList();
    }

    seedSampleData() {
        const sampleEntries = [
            { daysAgo: 45, mood: 'okay',     factors: ['stress'],                notes: 'First day tracking. Feeling neutral about the week ahead.' },
            { daysAgo: 44, mood: 'bad',      factors: ['stress', 'sleep'],       notes: 'Barely slept 4 hours. Anxiety kept me up.' },
            { daysAgo: 43, mood: 'bad',      factors: ['stress'],                notes: 'Missed a deadline at work. Feeling overwhelmed.' },
            { daysAgo: 42, mood: 'okay',     factors: ['social'],                notes: 'Talked to mom on the phone. Helped a bit.' },
            { daysAgo: 41, mood: 'good',     factors: ['exercise', 'sleep'],     notes: 'Finally slept 7 hours. Morning stretches.' },
            { daysAgo: 40, mood: 'good',     factors: ['exercise', 'nutrition'], notes: 'Meal prepped for the week. Feeling organized.' },
            { daysAgo: 39, mood: 'great',    factors: ['social', 'exercise'],    notes: 'Weekend hike with friends. Beautiful weather.' },
            { daysAgo: 38, mood: 'good',     factors: ['sleep', 'nutrition'],    notes: 'Relaxed Sunday. Read a book and cooked pasta.' },
            { daysAgo: 37, mood: 'okay',     factors: ['stress'],                notes: 'Monday blues. Lots of meetings today.' },
            { daysAgo: 36, mood: 'okay',     factors: ['stress', 'nutrition'],   notes: 'Skipped lunch due to work. Not great.' },
            { daysAgo: 35, mood: 'good',     factors: ['exercise'],              notes: '30 min jog after work. Cleared my head.' },
            { daysAgo: 34, mood: 'good',     factors: ['social', 'sleep'],       notes: 'Dinner with college friends. Slept well.' },
            { daysAgo: 33, mood: 'great',    factors: ['exercise', 'social'],    notes: 'Group yoga class. Met someone new.' },
            { daysAgo: 32, mood: 'good',     factors: ['nutrition', 'sleep'],    notes: 'Healthy smoothie bowl. Early to bed.' },
            { daysAgo: 31, mood: 'great',    factors: ['social', 'exercise'],    notes: 'Beach day! Volleyball and swimming.' },
            { daysAgo: 30, mood: 'good',     factors: ['sleep'],                 notes: 'Lazy Sunday. 9 hours of sleep.' },
            { daysAgo: 29, mood: 'okay',     factors: ['stress'],                notes: 'Presentation tomorrow. Rehearsed 3 times.' },
            { daysAgo: 28, mood: 'good',     factors: ['social'],                notes: 'Presentation went well! Team was supportive.' },
            { daysAgo: 27, mood: 'great',    factors: ['exercise', 'nutrition'], notes: 'New personal best on my run. Green smoothie.' },
            { daysAgo: 26, mood: 'good',     factors: ['sleep', 'exercise'],     notes: 'Solid routine day. Gym + 8h sleep.' },
            { daysAgo: 25, mood: 'okay',     factors: ['stress', 'social'],      notes: 'Argument with a friend. Feeling conflicted.' },
            { daysAgo: 24, mood: 'bad',      factors: ['stress', 'sleep'],       notes: 'Couldn\'t stop overthinking. Poor sleep.' },
            { daysAgo: 23, mood: 'okay',     factors: ['exercise'],              notes: 'Forced myself to walk. It helped a bit.' },
            { daysAgo: 22, mood: 'good',     factors: ['social'],                notes: 'Resolved things with my friend. Relief.' },
            { daysAgo: 21, mood: 'good',     factors: ['exercise', 'nutrition'], notes: 'Back on track. Healthy meals all day.' },
            { daysAgo: 20, mood: 'great',    factors: ['social', 'exercise'],    notes: 'Saturday park run with the group.' },
            { daysAgo: 19, mood: 'good',     factors: ['sleep', 'nutrition'],    notes: 'Restful weekend. Made homemade soup.' },
            { daysAgo: 18, mood: 'okay',     factors: ['stress'],                notes: 'New project at work. Uncertain about scope.' },
            { daysAgo: 17, mood: 'good',     factors: ['exercise', 'sleep'],     notes: 'Evening swim. Slept like a baby.' },
            { daysAgo: 16, mood: 'good',     factors: ['nutrition', 'social'],   notes: 'Cooking class with a colleague. Fun!' },
            { daysAgo: 15, mood: 'great',    factors: ['exercise', 'social'],    notes: 'Dance class! Haven\'t laughed this hard in weeks.' },
            { daysAgo: 14, mood: 'good',     factors: ['sleep'],                 notes: 'Caught up on sleep. Feeling refreshed.' },
            { daysAgo: 13, mood: 'great',    factors: ['social', 'nutrition'],   notes: 'Brunch with family. Grandma\'s special recipe.' },
            { daysAgo: 12, mood: 'okay',     factors: ['stress', 'sleep'],       notes: 'Deadline crunch. Stayed up late.' },
            { daysAgo: 11, mood: 'bad',      factors: ['stress', 'sleep'],       notes: 'Exhausted. Running on coffee.' },
            { daysAgo: 10, mood: 'okay',     factors: ['stress', 'sleep'],       notes: 'Submitted the project. Weight off shoulders.' },
            { daysAgo: 9,  mood: 'good',     factors: ['sleep', 'exercise'],     notes: 'Recovery day. Long nap and gentle walk.' },
            { daysAgo: 8,  mood: 'good',     factors: ['exercise', 'nutrition'], notes: 'Back to the gym. Protein-rich dinner.' },
            { daysAgo: 7,  mood: 'great',    factors: ['exercise', 'social'],    notes: 'Had a great call with an old friend.' },
            { daysAgo: 6,  mood: 'good',     factors: ['sleep', 'nutrition'],    notes: 'Slept 8 hours. Feeling rested.' },
            { daysAgo: 5,  mood: 'great',    factors: ['exercise', 'social'],    notes: 'Morning jog + coffee with a friend.' },
            { daysAgo: 4,  mood: 'good',     factors: ['nutrition'],             notes: 'Cooked a healthy meal. Tried a new recipe.' },
            { daysAgo: 3,  mood: 'okay',     factors: ['stress'],                notes: 'Work piled up again. Need to pace myself.' },
            { daysAgo: 2,  mood: 'good',     factors: ['exercise', 'sleep'],     notes: 'Yoga session in the evening. Slept 8h.' },
            { daysAgo: 1,  mood: 'great',    factors: ['social', 'exercise'],    notes: 'Productive day and a nice sunset walk.' },
        ];

        const now = new Date();
        sampleEntries.forEach(s => {
            const d = new Date(now);
            d.setDate(d.getDate() - s.daysAgo);
            d.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
            this.moodData.push({
                date: d.toISOString(),
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
        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
    }

    saveMoodEntry() {
        const selectedMood = document.querySelector('.mood-btn.active')?.dataset.mood;
        const factors = Array.from(document.querySelectorAll('.factors-grid input:checked'))
            .map(input => input.value);
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

        const moodValues = {
            'great': 5,
            'good': 4,
            'okay': 3,
            'bad': 2,
            'terrible': 1
        };

        const recentEntries = this.moodData.slice(-7);

        const padding = 40;
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - (padding * 2);

        const primaryColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--primary-color').trim() || '#5B8A72';

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

            ctx.stroke();
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
        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.factors-grid input').forEach(input => {
            input.checked = false;
        });
        document.querySelector('.mood-notes textarea').value = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MoodTracker();
});
