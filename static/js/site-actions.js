document.addEventListener("DOMContentLoaded", () => {
  const page = location.pathname.split("/").pop() || "Home.html";

  function goTo(url) {
    window.location.href = url;
  }

  function ensureToast() {
    let toast = document.getElementById("site-action-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "site-action-toast";
      toast.className =
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-white px-5 py-3 rounded-lg shadow-xl text-sm font-semibold opacity-0 translate-y-4 transition-all duration-300";
      document.body.appendChild(toast);
    }
    return toast;
  }

  function showToast(message, kind = "success") {
    const toast = ensureToast();
    toast.textContent = message;
    toast.classList.remove("opacity-0", "translate-y-4");
    toast.classList.toggle("bg-error", kind === "error");
    toast.classList.toggle("bg-secondary", kind === "info");
    toast.classList.toggle("bg-primary", kind === "success");
    window.clearTimeout(window.__siteToastTimer);
    window.__siteToastTimer = window.setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-4");
    }, 2200);
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "X-Requested-With": "fetch" },
      body,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "Request failed.");
    }
    return payload;
  }

  function fileToDataUrl(file, callback) {
    if (!file) {
      callback(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => callback(reader.result);
    reader.readAsDataURL(file);
  }

  function preparePhoto(file, callback) {
    fileToDataUrl(file, callback);
  }

  function bindAdminActions() {
    document.querySelectorAll(".admin-record-action").forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = "1";
      button.addEventListener("click", async () => {
        try {
          const body = new URLSearchParams({
            type: button.dataset.type || "",
            id: button.dataset.id || "",
            action: button.dataset.action || "",
            item_type: button.dataset.itemType || "",
          });
          const result = await postJson("/admin/action", body);
          showToast(result.message || "Admin action saved.", "success");
          window.setTimeout(() => window.location.reload(), 400);
        } catch (error) {
          showToast(error.message, "error");
        }
      });
    });
  }

  function bindLogoutLinks() {
    document.querySelectorAll('a[href="Login.html"], a[href="/Login.html"]').forEach((link) => {
      if (!/Sign Out|Logout/i.test(link.textContent || "")) return;
      link.setAttribute("href", "/logout");
    });
  }

  window.goTo = goTo;
  window.showToast = window.showToast || showToast;
  window.showAdminToast = window.showAdminToast || showToast;
  window.founderPreparePhoto = window.founderPreparePhoto || preparePhoto;
  window.renderManagedItemsFromStorage = window.renderManagedItemsFromStorage || (() => {});
  window.postJson = window.postJson || postJson;
  window.bindAdminActions = bindAdminActions;

  bindAdminActions();
  bindLogoutLinks();

  if (page === "Home.html" || page === "Items&search.html" || page === "Login.html") {
    return;
  }
});
