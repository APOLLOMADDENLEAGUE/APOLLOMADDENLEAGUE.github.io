(() => {
  const target = new Date('2026-09-05T20:30:00-04:00').getTime();
  const ids = ['months','days','hours','minutes','seconds'];
  const el = Object.fromEntries(ids.map(id => [id, document.getElementById(`aml-countdown-${id}`)]));
  const subtitle = document.getElementById('aml-countdown-subtitle');
  if (!subtitle || ids.some(id => !el[id])) return;

  const pad = n => String(Math.max(0, n)).padStart(2, '0');
  const update = () => {
    let diff = target - Date.now();
    if (diff <= 0) {
      ids.forEach(id => { el[id].textContent = '00'; });
      subtitle.textContent = 'SEASON 14 IS HERE';
      return;
    }
    const months = 0;
    const days = Math.floor(diff / 86400000); diff %= 86400000;
    const hours = Math.floor(diff / 3600000); diff %= 3600000;
    const minutes = Math.floor(diff / 60000); diff %= 60000;
    const seconds = Math.floor(diff / 1000);
    el.months.textContent = pad(months);
    el.days.textContent = pad(days);
    el.hours.textContent = pad(hours);
    el.minutes.textContent = pad(minutes);
    el.seconds.textContent = pad(seconds);
  };
  update();
  window.setInterval(update, 1000);
})();
