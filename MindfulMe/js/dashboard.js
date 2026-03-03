class Dashboard {
    constructor() {
        this.moodData = Storage.get('moodData', []) || [];
        this.moodValues = { great: 5, good: 4, okay: 3, bad: 2, terrible: 1 };
        this.moodLabels = { 5: 'Great', 4: 'Good', 3: 'Okay', 2: 'Bad', 1: 'Terrible' };
        this.moodEmoji = { great: '😊', good: '🙂', okay: '😐', bad: '😕', terrible: '😢' };
        this.moodColors = {
            great: '#5B8A72', good: '#7BA896', okay: '#E8B86D', bad: '#E07A5F', terrible: '#C4604A'
        };

        this.renderStats();
        this.renderTrendChart();
        this.renderDistribution();
        this.renderTopFactors();
        this.renderInsights();
        this.renderWeeklySummary();
    }

    getStreak() {
        if (this.moodData.length === 0) return 0;

        const dateSet = new Set();
        this.moodData.forEach(e => {
            const d = new Date(e.date);
            dateSet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        });

        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 365; i++) {
            const check = new Date(today);
            check.setDate(check.getDate() - i);
            const key = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
            if (dateSet.has(key)) {
                streak++;
            } else {
                if (i === 0) continue;
                break;
            }
        }
        return streak;
    }

    getAverageMood(entries) {
        if (entries.length === 0) return 0;
        const sum = entries.reduce((acc, e) => acc + (this.moodValues[e.mood] || 3), 0);
        return sum / entries.length;
    }

    getWellnessScore() {
        const recent = this.getRecentEntries(14);
        if (recent.length === 0) return 0;

        const avgMood = this.getAverageMood(recent);
        const moodScore = ((avgMood - 1) / 4) * 50;

        const streak = Math.min(this.getStreak(), 14);
        const consistencyScore = (streak / 14) * 30;

        const allFactors = recent.flatMap(e => e.factors || []);
        const posFactors = allFactors.filter(f => ['exercise', 'sleep', 'nutrition', 'social'].includes(f));
        const factorScore = Math.min((posFactors.length / (recent.length * 2)) * 20, 20);

        return Math.round(moodScore + consistencyScore + factorScore);
    }

    getRecentEntries(days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        cutoff.setHours(0, 0, 0, 0);
        return this.moodData.filter(e => new Date(e.date) >= cutoff);
    }

    renderStats() {
        const container = document.getElementById('dash-stats');
        if (!container) return;

        const total = this.moodData.length;
        const avg = this.getAverageMood(this.moodData);
        const avgLabel = avg > 0 ? this.moodLabels[Math.round(avg)] : '—';
        const streak = this.getStreak();
        const wellness = this.getWellnessScore();

        const wellnessColor = wellness >= 70 ? 'var(--primary)' : wellness >= 40 ? 'var(--accent)' : 'var(--danger)';

        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-card__value">${total}</div>
                <div class="stat-card__label">Total Entries</div>
            </div>
            <div class="stat-card">
                <div class="stat-card__value">${avgLabel}</div>
                <div class="stat-card__label">Average Mood</div>
            </div>
            <div class="stat-card stat-card--streak">
                <div class="stat-card__value">${streak}<span class="stat-card__unit">days</span></div>
                <div class="stat-card__label">Current Streak</div>
            </div>
            <div class="stat-card">
                <div class="stat-card__value" style="color:${wellnessColor}">${wellness}<span class="stat-card__unit">/100</span></div>
                <div class="stat-card__label">Wellness Score</div>
            </div>
        `;
    }

    renderTrendChart() {
        const canvas = document.getElementById('dash-trend-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const entries = this.getRecentEntries(30);
        if (entries.length === 0) {
            ctx.fillStyle = '#B2BEC3';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No mood data for the last 30 days', canvas.width / 2, canvas.height / 2);
            return;
        }

        const dayMap = {};
        entries.forEach(e => {
            const d = new Date(e.date);
            const key = `${d.getMonth() + 1}/${d.getDate()}`;
            dayMap[key] = this.moodValues[e.mood] || 3;
        });

        const days = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = `${d.getMonth() + 1}/${d.getDate()}`;
            days.push({ label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: dayMap[key] || null });
        }

        const padding = { top: 30, right: 20, bottom: 40, left: 55 };
        const chartW = canvas.width - padding.left - padding.right;
        const chartH = canvas.height - padding.top - padding.bottom;

        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#636E72';
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#E8E2D9';
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#3ac47d';

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        const labels = ['Terrible', 'Bad', 'Okay', 'Good', 'Great'];
        for (let i = 0; i < 5; i++) {
            const y = padding.top + ((4 - i) * (chartH / 4));
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(canvas.width - padding.right, y);
            ctx.stroke();

            ctx.fillStyle = textColor;
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(labels[i], padding.left - 8, y + 4);
        }

        const filledDays = days.filter(d => d.value !== null);
        if (filledDays.length === 0) return;

        const spacing = chartW / (days.length - 1 || 1);
        const points = [];
        days.forEach((d, i) => {
            if (d.value !== null) {
                points.push({
                    x: padding.left + i * spacing,
                    y: padding.top + (4 - (d.value - 1)) * (chartH / 4),
                    label: d.label
                });
            }
        });

        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
        gradient.addColorStop(0, primaryColor + '30');
        gradient.addColorStop(1, primaryColor + '05');

        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, padding.top + chartH);
            points.forEach(pt => ctx.lineTo(pt.x, pt.y));
            ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();
        }

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
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 2;
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.stroke();
        });

        ctx.fillStyle = textColor;
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        const step = Math.max(1, Math.floor(days.length / 8));
        days.forEach((d, i) => {
            if (i % step === 0 || i === days.length - 1) {
                const x = padding.left + i * spacing;
                ctx.fillText(d.label, x, canvas.height - padding.bottom + 20);
            }
        });
    }

    renderDistribution() {
        const container = document.getElementById('dash-distribution');
        if (!container) return;

        const counts = { great: 0, good: 0, okay: 0, bad: 0, terrible: 0 };
        this.moodData.forEach(e => { if (counts[e.mood] !== undefined) counts[e.mood]++; });
        const total = this.moodData.length || 1;

        const items = Object.entries(counts).map(([mood, count]) => {
            const pct = Math.round((count / total) * 100);
            return `
                <div class="dist-row">
                    <span class="dist-row__label">${this.moodEmoji[mood]} ${mood.charAt(0).toUpperCase() + mood.slice(1)}</span>
                    <div class="dist-row__bar-track">
                        <div class="dist-row__bar-fill" style="width:${pct}%;background:${this.moodColors[mood]}"></div>
                    </div>
                    <span class="dist-row__pct">${pct}%</span>
                </div>
            `;
        });

        container.innerHTML = items.join('');
    }

    renderTopFactors() {
        const container = document.getElementById('dash-factors');
        if (!container) return;

        const factorCounts = {};
        this.moodData.forEach(e => {
            (e.factors || []).forEach(f => {
                factorCounts[f] = (factorCounts[f] || 0) + 1;
            });
        });

        const sorted = Object.entries(factorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const max = sorted[0] ? sorted[0][1] : 1;

        const factorIcons = {
            exercise: '🏃', sleep: '😴', stress: '😰', social: '👥', nutrition: '🥗'
        };

        const items = sorted.map(([factor, count]) => {
            const pct = Math.round((count / max) * 100);
            const icon = factorIcons[factor] || '📌';
            return `
                <div class="dist-row">
                    <span class="dist-row__label">${icon} ${factor.charAt(0).toUpperCase() + factor.slice(1)}</span>
                    <div class="dist-row__bar-track">
                        <div class="dist-row__bar-fill" style="width:${pct}%;background:var(--primary)"></div>
                    </div>
                    <span class="dist-row__pct">${count}×</span>
                </div>
            `;
        });

        container.innerHTML = items.length > 0 ? items.join('') : '<p class="dash-empty">No factor data yet.</p>';
    }

    renderInsights() {
        const container = document.getElementById('dash-insights');
        if (!container) return;

        const factors = ['exercise', 'sleep', 'nutrition', 'social', 'stress'];
        const factorIcons = {
            exercise: '🏃', sleep: '😴', stress: '😰', social: '👥', nutrition: '🥗'
        };

        const insights = [];

        factors.forEach(factor => {
            const withFactor = this.moodData.filter(e => (e.factors || []).includes(factor));
            const withoutFactor = this.moodData.filter(e => !(e.factors || []).includes(factor));

            if (withFactor.length < 3) return;

            const avgWith = this.getAverageMood(withFactor);
            const avgWithout = withoutFactor.length > 0 ? this.getAverageMood(withoutFactor) : 3;
            const diff = avgWith - avgWithout;
            const absDiff = Math.abs(diff);

            if (absDiff < 0.15) return;

            const direction = diff > 0 ? 'better' : 'worse';
            const label = factor.charAt(0).toUpperCase() + factor.slice(1);
            const icon = factorIcons[factor] || '📌';

            const pctWith = Math.round((withFactor.filter(e => this.moodValues[e.mood] >= 4).length / withFactor.length) * 100);

            let message, sentiment;
            if (factor === 'stress') {
                message = `When <strong>Stress</strong> is a factor, your mood averages <strong>${this.moodLabels[Math.round(avgWith)]}</strong>. On stress-free days, you average <strong>${this.moodLabels[Math.round(avgWithout)]}</strong>.`;
                sentiment = 'negative';
            } else if (diff > 0) {
                message = `On days with <strong>${label}</strong>, you feel <strong>${this.moodLabels[Math.round(avgWith)]}</strong> ${pctWith}% of the time. That's noticeably better than days without it.`;
                sentiment = 'positive';
            } else {
                message = `<strong>${label}</strong> days correlate with slightly lower mood (<strong>${this.moodLabels[Math.round(avgWith)]}</strong> avg). Consider how it affects you.`;
                sentiment = 'neutral';
            }

            insights.push({ icon, label, message, sentiment, impact: absDiff });
        });

        insights.sort((a, b) => b.impact - a.impact);

        if (insights.length === 0) {
            container.innerHTML = '<p class="dash-empty">Log more entries to see mood-factor correlations.</p>';
            return;
        }

        container.innerHTML = insights.map(ins => `
            <div class="insight-card insight-card--${ins.sentiment}">
                <div class="insight-card__icon">${ins.icon}</div>
                <div class="insight-card__body">
                    <h3>${ins.label}</h3>
                    <p>${ins.message}</p>
                </div>
            </div>
        `).join('');
    }

    renderWeeklySummary() {
        const container = document.getElementById('dash-weekly');
        if (!container) return;

        const thisWeek = this.getRecentEntries(7);
        const lastWeek = this.moodData.filter(e => {
            const d = new Date(e.date);
            const now = new Date();
            const daysAgo = (now - d) / (1000 * 60 * 60 * 24);
            return daysAgo >= 7 && daysAgo < 14;
        });

        if (thisWeek.length === 0) {
            container.innerHTML = '<p class="dash-empty">No entries this week yet. Start logging to see your summary!</p>';
            return;
        }

        const avgThis = this.getAverageMood(thisWeek);
        const avgLast = lastWeek.length > 0 ? this.getAverageMood(lastWeek) : null;

        const allFactors = thisWeek.flatMap(e => e.factors || []);
        const factorCounts = {};
        allFactors.forEach(f => { factorCounts[f] = (factorCounts[f] || 0) + 1; });
        const topFactor = Object.entries(factorCounts).sort((a, b) => b[1] - a[1])[0];

        const moodCounts = {};
        thisWeek.forEach(e => { moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1; });
        const dominant = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];

        let trendText = '';
        if (avgLast !== null) {
            const diff = avgThis - avgLast;
            if (diff > 0.3) trendText = '📈 Your mood improved compared to last week.';
            else if (diff < -0.3) trendText = '📉 Your mood dipped a bit from last week.';
            else trendText = '➡️ Your mood stayed consistent with last week.';
        }

        const bestDay = thisWeek.reduce((best, e) => {
            return (this.moodValues[e.mood] || 0) > (this.moodValues[best.mood] || 0) ? e : best;
        }, thisWeek[0]);
        const bestDayLabel = new Date(bestDay.date).toLocaleDateString('en-US', { weekday: 'long' });

        container.innerHTML = `
            <div class="weekly-grid">
                <div class="weekly-stat">
                    <div class="weekly-stat__emoji">${this.moodEmoji[dominant[0]]}</div>
                    <div class="weekly-stat__text">
                        <strong>Dominant mood:</strong> ${dominant[0].charAt(0).toUpperCase() + dominant[0].slice(1)} (${dominant[1]} of ${thisWeek.length} days)
                    </div>
                </div>
                <div class="weekly-stat">
                    <div class="weekly-stat__emoji">⭐</div>
                    <div class="weekly-stat__text">
                        <strong>Best day:</strong> ${bestDayLabel} — "${bestDay.notes || 'No notes'}"
                    </div>
                </div>
                ${topFactor ? `
                <div class="weekly-stat">
                    <div class="weekly-stat__emoji">🔑</div>
                    <div class="weekly-stat__text">
                        <strong>Top factor:</strong> ${topFactor[0].charAt(0).toUpperCase() + topFactor[0].slice(1)} (appeared ${topFactor[1]}× this week)
                    </div>
                </div>` : ''}
                ${trendText ? `
                <div class="weekly-stat">
                    <div class="weekly-stat__emoji"></div>
                    <div class="weekly-stat__text">${trendText}</div>
                </div>` : ''}
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});
