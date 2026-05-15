import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBbpH2LgmheTQlDhU7IBRlsAgyvzALE4Sk",
  authDomain: "clover-consulting.firebaseapp.com",
  projectId: "clover-consulting",
  storageBucket: "clover-consulting.firebasestorage.app",
  messagingSenderId: "452766218507",
  appId: "1:452766218507:web:d8f8038b588de84f7b8a0e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

async function signIn() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    if (
      err.code === "auth/popup-closed-by-user" ||
      err.code === "auth/cancelled-popup-request" ||
      err.code === "auth/popup-blocked"
    ) {
      return null;
    }
    console.error("Sign-in failed:", err);
    alert("Sign-in failed: " + (err.message || err.code));
    return null;
  }
}

window.cloverAuth = {
  user: null,
  isReady: false,
  signIn,
  signOut: () => signOut(auth),
  getIdToken: async () => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  }
};

function autofillUserFields(user) {
  document.querySelectorAll('input[data-autofill="name"]').forEach((el) => {
    el.value = user.displayName || "";
  });
  document.querySelectorAll('input[data-autofill="email"]').forEach((el) => {
    el.value = user.email || "";
  });
}

function clearAutofillFields() {
  document.querySelectorAll("input[data-autofill]").forEach((el) => {
    el.value = "";
  });
}

function updateAuthUI(user) {
  document.body.classList.toggle("logged-in", !!user);
  document.body.classList.remove("auth-pending");

  const signInBtn = document.getElementById("auth-signin-btn");
  const userBadge = document.getElementById("user-badge");
  const userBadgeName = document.getElementById("user-badge-name");
  const userBadgeAvatar = document.getElementById("user-badge-avatar");

  if (user) {
    if (signInBtn) signInBtn.hidden = true;
    if (userBadge) userBadge.hidden = false;
    if (userBadgeName) {
      userBadgeName.textContent = user.displayName || user.email || "Account";
    }
    if (userBadgeAvatar) {
      if (user.photoURL) {
        userBadgeAvatar.src = user.photoURL;
        userBadgeAvatar.hidden = false;
      } else {
        userBadgeAvatar.hidden = true;
      }
    }
    autofillUserFields(user);
  } else {
    if (signInBtn) signInBtn.hidden = false;
    if (userBadge) userBadge.hidden = true;
    clearAutofillFields();
  }
}

onAuthStateChanged(auth, (user) => {
  window.cloverAuth.user = user;
  window.cloverAuth.isReady = true;
  updateAuthUI(user);
  window.dispatchEvent(new CustomEvent("clover-auth-changed", { detail: user }));
});

const signInBtn = document.getElementById("auth-signin-btn");
const signOutBtn = document.getElementById("auth-signout-btn");
if (signInBtn) signInBtn.addEventListener("click", signIn);
if (signOutBtn) signOutBtn.addEventListener("click", () => signOut(auth));
