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
