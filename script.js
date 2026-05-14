const words = [
  "stand out.",
  "tell your story.",
  "get admitted.",
  "do it right."
];

const typingTarget = document.getElementById("typing-text");

let wordIndex = 0;
let charIndex = 0;
let deleting = false;

function tick() {
  if (!typingTarget) {
    return;
  }

  const currentWord = words[wordIndex];

  if (deleting) {
    charIndex -= 1;
  } else {
    charIndex += 1;
  }

  typingTarget.textContent = currentWord.slice(0, charIndex);

  let delay = deleting ? 55 : 95;

  if (!deleting && charIndex === currentWord.length) {
    delay = 1200;
    deleting = true;
  } else if (deleting && charIndex === 0) {
    deleting = false;
    wordIndex = (wordIndex + 1) % words.length;
    delay = 350;
  }

  setTimeout(tick, delay);
}

tick();

const logoMarquee = document.getElementById("logo-marquee");
const logoFolder = "acceptance-logos";
const imagePattern = /\.(png|jpe?g|webp|gif|svg)$/i;
const extensionPriority = { ".png": 4, ".webp": 3, ".jpg": 2, ".jpeg": 2, ".gif": 1, ".svg": 1 };
let logoTickerFrame = null;
let logoResizeHandler = null;

function dedupeBySchoolName(entries) {
  const bestByStem = new Map();
  for (const entry of entries) {
    const stem = entry.name.replace(/\.[^.]+$/, "").toLowerCase().trim();
    const ext = (entry.name.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
    const score = extensionPriority[ext] || 0;
    const existing = bestByStem.get(stem);
    if (!existing || score > existing.score) {
      bestByStem.set(stem, { ...entry, score });
    }
  }
  return Array.from(bestByStem.values()).map((item) => item.url);
}

function getGitHubRepoFromPage() {
  if (!window.location.hostname.endsWith("github.io")) {
    return null;
  }

  const owner = window.location.hostname.split(".")[0];
  const repo = window.location.pathname.split("/").filter(Boolean)[0];

  if (!owner || !repo) {
    return null;
  }

  return { owner, repo };
}

function createLogoImage(src) {
  const image = document.createElement("img");
  image.src = src;
  image.alt = "Accepted school logo";
  image.className = "logo-item";
  image.loading = "lazy";
  return image;
}

function renderLogoMarquee(logoUrls) {
  if (!logoMarquee) {
    return;
  }

  if (logoTickerFrame) {
    cancelAnimationFrame(logoTickerFrame);
    logoTickerFrame = null;
  }
  if (logoResizeHandler) {
    window.removeEventListener("resize", logoResizeHandler);
    logoResizeHandler = null;
  }

  if (!logoUrls.length) {
    logoMarquee.innerHTML = "<p class=\"logo-empty\">Acceptance logos will appear here.</p>";
    return;
  }

  const uniqueUrls = Array.from(new Set(logoUrls));
  const track = document.createElement("div");
  track.className = "logo-track";

  const nodes = uniqueUrls.map((url) => {
    const node = document.createElement("div");
    node.className = "logo-node";
    node.appendChild(createLogoImage(url));
    track.appendChild(node);
    return node;
  });
  logoMarquee.replaceChildren(track);

  if (uniqueUrls.length <= 1) {
    return;
  }

  const gap = 14;
  const speedPxPerSecond = 72;
  let states = [];
  let lastTime = performance.now();

  function initializePositions() {
    let nextX = logoMarquee.clientWidth;
    states = nodes.map((node) => {
      const width = node.getBoundingClientRect().width;
      const state = { node, width, x: nextX };
      nextX += width + gap;
      return state;
    });
  }

  function applyPositions() {
    states.forEach((item) => {
      item.node.style.left = `${item.x}px`;
    });
  }

  initializePositions();
  applyPositions();

  function step(now) {
    const elapsed = (now - lastTime) / 1000;
    lastTime = now;

    states.forEach((item) => {
      item.x -= speedPxPerSecond * elapsed;
    });

    states.forEach((item) => {
      if (item.x + item.width < 0) {
        const maxRight = states.reduce((maxValue, current) => {
          if (current === item) {
            return maxValue;
          }
          return Math.max(maxValue, current.x + current.width);
        }, 0);
        item.x = Math.max(maxRight + gap, logoMarquee.clientWidth);
      }
    });

    applyPositions();
    logoTickerFrame = requestAnimationFrame(step);
  }

  logoResizeHandler = () => {
    initializePositions();
    applyPositions();
  };
  window.addEventListener("resize", logoResizeHandler);
  logoTickerFrame = requestAnimationFrame(step);
}

async function fetchLogosFromGitHubFolder() {
  const repoInfo = getGitHubRepoFromPage();
  if (!repoInfo) {
    return [];
  }

  const url = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/${logoFolder}`;
  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }

  const files = await response.json();
  if (!Array.isArray(files)) {
    return [];
  }

  const entries = files
    .filter((file) => file && imagePattern.test(file.name || "") && file.download_url)
    .map((file) => ({ name: file.name, url: file.download_url }));
  return dedupeBySchoolName(entries);
}

async function fetchLogosFromDirectoryListing() {
  const response = await fetch(`./${logoFolder}/`);
  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = Array.from(doc.querySelectorAll("a"));

  const entries = links
    .map((link) => link.getAttribute("href") || "")
    .map((href) => href.split("/").pop() || "")
    .filter((name) => imagePattern.test(name))
    .map((name) => ({ name, url: `./${logoFolder}/${name}` }));
  return dedupeBySchoolName(entries);
}

async function loadAcceptanceLogos() {
  try {
    const githubLogos = await fetchLogosFromGitHubFolder();
    if (githubLogos.length) {
      renderLogoMarquee(githubLogos);
      return;
    }

    const localLogos = await fetchLogosFromDirectoryListing();
    renderLogoMarquee(localLogos);
  } catch (error) {
    renderLogoMarquee([]);
  }
}

loadAcceptanceLogos();

const contactForm = document.getElementById("contact-form");
const formStatus = document.getElementById("form-status");

function setFormStatus(message, state = "") {
  if (!formStatus) {
    return;
  }
  formStatus.textContent = message;
  formStatus.classList.remove("success", "error");
  if (state) {
    formStatus.classList.add(state);
  }
}

if (contactForm) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = contactForm.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }

    setFormStatus("Sending your inquiry...");

    const endpoint = contactForm.dataset.ajaxEndpoint || "";
    const body = new FormData(contactForm);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body,
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error("Form service unavailable");
      }

      contactForm.reset();
      setFormStatus("Thanks! Your inquiry was sent successfully.", "success");
    } catch (error) {
      setFormStatus(
        "The form service is temporarily unavailable. Please email cloverconsult26@gmail.com directly.",
        "error"
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit";
      }
    }
  });
}
