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

const ucFormWrap = document.getElementById("uc-form-wrap");

function showPackageForm(targetWrap, focusId) {
  [essayFormWrap, ucFormWrap].forEach((w) => {
    if (w) w.hidden = w !== targetWrap;
  });
  if (targetWrap) {
    targetWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    if (focusId) {
      const focusEl = document.getElementById(focusId);
      if (focusEl) focusEl.focus();
    }
  }
}

function requireAuthThen(callback) {
  const auth = window.cloverAuth;
  if (auth && auth.user) {
    callback();
    return;
  }
  if (auth && typeof auth.signIn === "function") {
    auth.signIn().then((user) => {
      if (user) callback();
    });
  } else {
    alert("Account system is loading. Please try again in a moment.");
  }
}

function handlePackageClick(card) {
  const pkg = card.dataset.package;
  if (pkg === "personal-statement" && essayFormWrap) {
    requireAuthThen(() => showPackageForm(essayFormWrap, "essay-prompt"));
  } else if (pkg === "uc-essays" && ucFormWrap) {
    requireAuthThen(() => showPackageForm(ucFormWrap, "uc-prompt-1"));
  } else {
    const contactSection = document.getElementById("contact");
    if (contactSection) contactSection.scrollIntoView({ behavior: "smooth" });
  }
}

const packageCards = document.querySelectorAll(".package-card[data-package]");
packageCards.forEach((card) => {
  card.addEventListener("click", (event) => {
    if (event.target.closest("a")) return;
    handlePackageClick(card);
  });
  if (card.getAttribute("role") === "button") {
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handlePackageClick(card);
      }
    });
  }
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

async function getCurrentIdToken() {
  if (window.cloverAuth && typeof window.cloverAuth.getIdToken === "function") {
    return await window.cloverAuth.getIdToken();
  }
  return null;
}

const PRICING_TIERS = {
  "personal-statement": {
    free: { main: "First essay free", sub: "then $65 per essay" },
    paid: { main: "$65", sub: "per essay" }
  },
  "uc-essays": {
    free: { main: "First essay free", sub: "then $180 for all 4" },
    paid: { main: "$180", sub: "all 4 essays" }
  }
};

function applyPricingForSubmissionCount(count) {
  const tier = count > 0 ? "paid" : "free";
  Object.keys(PRICING_TIERS).forEach((pkg) => {
    const card = document.querySelector(`.package-card[data-package="${pkg}"]`);
    if (!card) return;
    const priceEl = card.querySelector('[data-pricing]');
    if (!priceEl) return;
    const labels = PRICING_TIERS[pkg][tier];
    priceEl.innerHTML =
      `<span class="price-main">${labels.main}</span>` +
      `<span class="price-sub">${labels.sub}</span>`;
    card.classList.toggle("is-free-tier", tier === "free");
  });
}

applyPricingForSubmissionCount(0);

async function refreshUserStatus() {
  const idToken = await getCurrentIdToken();
  if (!idToken || !ESSAY_DOC_ENDPOINT) return;
  try {
    const res = await fetch(ESSAY_DOC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ idToken, action: "status" })
    });
    const data = await res.json().catch(() => ({}));
    if (typeof data.submissionCount === "number") {
      applyPricingForSubmissionCount(data.submissionCount);
    }
  } catch (e) {
  }
}

window.addEventListener("clover-auth-changed", (event) => {
  if (event.detail) {
    refreshUserStatus();
  } else {
    applyPricingForSubmissionCount(0);
  }
});

if (window.cloverAuth && window.cloverAuth.user) {
  refreshUserStatus();
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

    if (!window.cloverAuth?.user) {
      setEssayStatus("Please sign in with Google before submitting.", "error");
      return;
    }
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
    const idToken = await getCurrentIdToken();

    let docUrl = "";

    if (ESSAY_DOC_ENDPOINT && idToken) {
      try {
        const docRes = await fetch(ESSAY_DOC_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            idToken,
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
        if (typeof docData.submissionCount === "number") {
          applyPricingForSubmissionCount(docData.submissionCount);
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

const ucForm = document.getElementById("uc-form");
const ucCancel = document.getElementById("uc-cancel");
const ucStatus = document.getElementById("uc-status");
const UC_LIMIT = 350;
const UC_ESSAY_COUNT = 4;

function updateUcWordCount(index) {
  const ta = document.getElementById(`uc-text-${index}`);
  const ctr = document.getElementById(`uc-counter-${index}`);
  if (!ta || !ctr) return;
  const n = countWords(ta.value);
  ctr.textContent = `${n} / ${UC_LIMIT} words`;
  ctr.classList.toggle("over", n > UC_LIMIT);
}

function resetUcCounters() {
  for (let i = 1; i <= UC_ESSAY_COUNT; i++) {
    const ctr = document.getElementById(`uc-counter-${i}`);
    if (ctr) {
      ctr.textContent = `0 / ${UC_LIMIT} words`;
      ctr.classList.remove("over");
    }
  }
}

for (let i = 1; i <= UC_ESSAY_COUNT; i++) {
  const ta = document.getElementById(`uc-text-${i}`);
  if (ta) {
    ta.addEventListener("input", () => updateUcWordCount(i));
    updateUcWordCount(i);
  }
}

function setUcStatus(message, state = "", asHtml = false) {
  if (!ucStatus) return;
  if (asHtml) {
    ucStatus.innerHTML = message;
  } else {
    ucStatus.textContent = message;
  }
  ucStatus.classList.remove("success", "error");
  if (state) ucStatus.classList.add(state);
}

if (ucCancel && ucForm) {
  ucCancel.addEventListener("click", () => {
    ucForm.reset();
    resetUcCounters();
    setUcStatus("");
    if (ucFormWrap) ucFormWrap.hidden = true;
  });
}

if (ucForm) {
  ucForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!window.cloverAuth?.user) {
      setUcStatus("Please sign in with Google before submitting.", "error");
      return;
    }

    const submitButton = ucForm.querySelector('button[type="submit"]');
    const formData = new FormData(ucForm);

    const essays = [];
    const seenPrompts = new Set();
    for (let i = 1; i <= UC_ESSAY_COUNT; i++) {
      const promptValue = (formData.get(`prompt-${i}`) || "").toString();
      const text = (formData.get(`essay-${i}`) || "").toString();
      const wordCount = countWords(text);
      const promptLabel =
        ucForm.querySelector(`#uc-prompt-${i} option[value="${promptValue}"]`)?.textContent ||
        promptValue;

      if (!promptValue) {
        setUcStatus(`Please choose a UC prompt for Essay ${i}.`, "error");
        return;
      }
      if (seenPrompts.has(promptValue)) {
        setUcStatus(`Each essay must use a different UC prompt. Essay ${i} duplicates an earlier one.`, "error");
        return;
      }
      seenPrompts.add(promptValue);

      if (wordCount === 0) {
        setUcStatus(`Please write your response for Essay ${i}.`, "error");
        return;
      }
      if (wordCount > UC_LIMIT) {
        setUcStatus(`Essay ${i} is ${wordCount} words. UC limit is ${UC_LIMIT} words.`, "error");
        return;
      }

      essays.push({ prompt: promptLabel, text, wordCount });
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }
    setUcStatus("Submitting your essays...");

    const concatenated = essays
      .map((e, i) => `=== Essay ${i + 1} ===\nPrompt: ${e.prompt}\nWord Count: ${e.wordCount}\n\n${e.text}\n`)
      .join("\n");
    const totalWords = essays.reduce((sum, e) => sum + e.wordCount, 0);

    const idToken = await getCurrentIdToken();

    let docUrl = "";
    if (ESSAY_DOC_ENDPOINT && idToken) {
      try {
        const docRes = await fetch(ESSAY_DOC_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            idToken,
            package: "UC Essays",
            essays,
            prompt: "UC PIQs (4 essays)",
            wordCount: totalWords,
            essay: concatenated
          })
        });
        const docData = await docRes.json().catch(() => ({}));
        if (docData && docData.url) {
          docUrl = docData.url;
        }
        if (typeof docData.submissionCount === "number") {
          applyPricingForSubmissionCount(docData.submissionCount);
        }
      } catch (e) {
      }
    }

    const w3Payload = {
      access_key: formData.get("access_key"),
      subject: "New UC PIQ Submission",
      from_name: "Clover Essay Submission",
      name: formData.get("name"),
      email: formData.get("email"),
      package: "UC Essays",
      total_word_count: totalWords,
      doc_url: docUrl || "(Google Doc auto-creation not configured)",
      essays: concatenated
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

      ucForm.reset();
      resetUcCounters();

      const successMsg = docUrl
        ? `Thanks! Your UC essays were submitted. <a href="${docUrl}" target="_blank" rel="noopener">View as a Google Doc</a>. We'll be in touch within 48 hours.`
        : "Thanks! Your UC essays were submitted successfully. We'll be in touch within 48 hours.";
      setUcStatus(successMsg, "success", !!docUrl);
    } catch (error) {
      setUcStatus(
        "Something went wrong submitting your essays. Please try again or email cloverconsult26@gmail.com directly.",
        "error"
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Essays";
      }
    }
  });
}
