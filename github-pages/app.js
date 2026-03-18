const sections = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
      }
    });
  },
  { threshold: 0.12 }
);

sections.forEach((section) => observer.observe(section));

const counter = document.getElementById('organizerCount');
let value = 0;
const target = 120;
const timer = setInterval(() => {
  value += 4;
  if (value >= target) {
    value = target;
    clearInterval(timer);
  }
  counter.textContent = value;
}, 35);

const setupHelpDialog = document.getElementById('setupHelpDialog');
const setupHelpTriggers = document.querySelectorAll('.setup-help-trigger');
const setupHelpClose = document.getElementById('setupHelpClose');

if (setupHelpDialog && setupHelpTriggers.length > 0) {
  const openDialog = () => {
    if (typeof setupHelpDialog.showModal === 'function') {
      setupHelpDialog.showModal();
      return;
    }
    setupHelpDialog.setAttribute('open', 'true');
  };

  const closeDialog = () => {
    if (typeof setupHelpDialog.close === 'function') {
      setupHelpDialog.close();
      return;
    }
    setupHelpDialog.removeAttribute('open');
  };

  setupHelpTriggers.forEach((trigger) => {
    trigger.addEventListener('click', openDialog);
  });

  if (setupHelpClose) {
    setupHelpClose.addEventListener('click', closeDialog);
  }

  setupHelpDialog.addEventListener('click', (event) => {
    const rect = setupHelpDialog.getBoundingClientRect();
    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (outside) closeDialog();
  });
}
