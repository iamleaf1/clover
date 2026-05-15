const words = [
  "find your voice.",
  "tell your story.",
  "feel confident.",
  "navigate the journey.",
  "get where you belong.",
  "get admitted."
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

function setFormStatus(message, state = "", asHtml = false) {
  if (!formStatus) {
    return;
  }
  if (asHtml) {
    formStatus.innerHTML = message;
  } else {
    formStatus.textContent = message;
  }
  formStatus.classList.remove("success", "error");
  if (state) {
    formStatus.classList.add(state);
  }
}

function createFallbackMailto(formData) {
  const name = (formData.get("name") || "").toString().trim();
  const email = (formData.get("email") || "").toString().trim();
  const studentYear = (formData.get("student-year") || "").toString().trim();
  const goals = (formData.get("message") || "").toString().trim();
  const bodyLines = [
    "New Clover inquiry",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Student Year: ${studentYear}`,
    "Goals:",
    goals
  ];
  const subject = encodeURIComponent("New Clover Inquiry");
  const body = encodeURIComponent(bodyLines.join("\n"));
  return `mailto:cloverconsult26@gmail.com?subject=${subject}&body=${body}`;
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
    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Form service unavailable");
      }

      contactForm.reset();
      setFormStatus("Thanks! Your inquiry was sent successfully.", "success");
    } catch (error) {
      const fallbackMailto = createFallbackMailto(formData);
      setFormStatus(
        `Something went wrong sending your inquiry. <a href="${fallbackMailto}">Send this inquiry by email instead</a>.`,
        "error",
        true
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit";
      }
    }
  });
}

const tabButtons = document.querySelectorAll(".tab");
const tabPanels = document.querySelectorAll(".tab-panel");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    tabButtons.forEach((b) => {
      const active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    tabPanels.forEach((panel) => {
      const show = panel.dataset.panel === target;
      panel.classList.toggle("active", show);
      panel.hidden = !show;
    });
  });
});

const essayFormWrap = document.getElementById("essay-form-wrap");
const essayForm = document.getElementById("essay-form");
const essayCancel = document.getElementById("essay-cancel");
const essayText = document.getElementById("essay-text");
const essayCounter = document.getElementById("essay-word-counter");
const essayStatus = document.getElementById("essay-status");
const ESSAY_LIMIT = 650;

const ESSAY_DOC_ENDPOINT = "https://script.google.com/macros/s/AKfycbydZuChid8Bt9ZO4efBAP2MC6UjpU1QjtrzCVduSnr56E3KtU6lheuirffjtlolOreeVg/exec";

const packageCards = document.querySelectorAll(".package-card[data-package]");
packageCards.forEach((card) => {
  card.addEventListener("click", () => {
    const pkg = card.dataset.package;
    if (pkg === "personal-statement" && essayFormWrap) {
      essayFormWrap.hidden = false;
      essayFormWrap.scrollIntoView({ behavior: "smooth", block: "start" });
      const nameInput = document.getElementById("essay-name");
      if (nameInput) nameInput.focus();
    } else {
      const contactSection = document.getElementById("contact");
      if (contactSection) contactSection.scrollIntoView({ behavior: "smooth" });
    }
  });
});

if (essayCancel && essayForm) {
  essayCancel.addEventListener("click", () => {
    essayForm.reset();
    updateEssayWordCount();
    setEssayStatus("");
    if (essayFormWrap) essayFormWrap.hidden = true;
  });
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function updateEssayWordCount() {
  if (!essayText || !essayCounter) return;
  const n = countWords(essayText.value);
  essayCounter.textContent = `${n} / ${ESSAY_LIMIT} words`;
  essayCounter.classList.toggle("over", n > ESSAY_LIMIT);
}

if (essayText) {
  essayText.addEventListener("input", updateEssayWordCount);
  updateEssayWordCount();
}

function setEssayStatus(message, state = "", asHtml = false) {
  if (!essayStatus) return;
  if (asHtml) {
    essayStatus.innerHTML = message;
  } else {
    essayStatus.textContent = message;
  }
  essayStatus.classList.remove("success", "error");
  if (state) essayStatus.classList.add(state);
}

if (essayForm) {
  essayForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = essayForm.querySelector('button[type="submit"]');
    const formData = new FormData(essayForm);
    const essayContent = (formData.get("essay") || "").toString();
    const wordCount = countWords(essayContent);

    if (wordCount === 0) {
      setEssayStatus("Please paste your essay before submitting.", "error");
      return;
    }
    if (wordCount > ESSAY_LIMIT) {
      setEssayStatus(
        `Your essay is ${wordCount} words. Please trim to ${ESSAY_LIMIT} words or fewer (Common App limit).`,
        "error"
      );
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }
    setEssayStatus("Submitting your essay...");

    const promptValue = (formData.get("prompt") || "").toString();
    const promptLabel = essayForm.querySelector(`#essay-prompt option[value="${promptValue}"]`)?.textContent || promptValue;

    let docUrl = "";

    if (ESSAY_DOC_ENDPOINT) {
      try {
        const docRes = await fetch(ESSAY_DOC_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            name: formData.get("name"),
            email: formData.get("email"),
            prompt: promptLabel,
            wordCount,
            essay: essayContent,
            package: "Personal Statement"
          })
        });
        const docData = await docRes.json().catch(() => ({}));
        if (docData && docData.url) {
          docUrl = docData.url;
        }
      } catch (e) {
      }
    }

    const w3Payload = {
      access_key: formData.get("access_key"),
      subject: "New Personal Statement Submission",
      from_name: "Clover Essay Submission",
      name: formData.get("name"),
      email: formData.get("email"),
      package: "Personal Statement",
      prompt: promptLabel,
      word_count: wordCount,
      doc_url: docUrl || "(Google Doc auto-creation not configured)",
      essay: essayContent
    };

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(w3Payload)
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.success === false) {
        throw new Error(result.message || "Submit failed");
      }

      essayForm.reset();
      updateEssayWordCount();

      const successMsg = docUrl
        ? `Thanks! Your essay was submitted. <a href="${docUrl}" target="_blank" rel="noopener">View it as a Google Doc</a>. We'll be in touch within 48 hours.`
        : "Thanks! Your essay was submitted successfully. We'll be in touch within 48 hours.";
      setEssayStatus(successMsg, "success", !!docUrl);
    } catch (error) {
      setEssayStatus(
        "Something went wrong submitting your essay. Please try again or email cloverconsult26@gmail.com directly.",
        "error"
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Essay";
      }
    }
  });
}
