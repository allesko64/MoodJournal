document.addEventListener('DOMContentLoaded', () => {
    const breathingCircle = document.querySelector('.breathing-circle');
    const breathingText = document.querySelector('.breathing-text');
    const startBtn = document.getElementById('start-breathing');
    const stopBtn = document.getElementById('stop-breathing');
    const breathCounter = document.getElementById('breath-counter');

    let isBreathing = false;
    let breathCount = Storage.get('breathCount', 0) || 0;
    let breathingInterval;

    breathCounter.textContent = breathCount;

    function startBreathing() {
        isBreathing = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        breathingCircle.classList.add('animate');
        updateBreathingText();
    }

    function stopBreathing() {
        isBreathing = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        breathingCircle.classList.remove('animate');
        breathingText.textContent = 'Press Start to begin';
        Storage.set('breathCount', breathCount);
        clearInterval(breathingInterval);
    }

    function updateBreathingText() {
        breathingText.textContent = 'Breathe in...';

        let phase = 0;
        breathingInterval = setInterval(() => {
            if (!isBreathing) return;

            if (phase === 0) {
                breathingText.textContent = 'Breathe out...';
                phase = 1;
                breathCount++;
                breathCounter.textContent = breathCount;
            } else {
                breathingText.textContent = 'Breathe in...';
                phase = 0;
            }
        }, 5000);
    }

    startBtn.addEventListener('click', startBreathing);
    stopBtn.addEventListener('click', stopBreathing);

    window.addEventListener('beforeunload', () => {
        Storage.set('breathCount', breathCount);
    });
});
