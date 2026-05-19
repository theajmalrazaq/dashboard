import AOS from "aos";
import "aos/dist/aos.css";

// Initialize Animate On Scroll (AOS)
document.addEventListener("DOMContentLoaded", function () {
  AOS.init({
    duration: 1200,
    once: false,
    delay: 100,
    mirror: true,
  });

  // Clean initialization refresh
  setTimeout(() => {
    AOS.refresh();
  }, 100);
});
