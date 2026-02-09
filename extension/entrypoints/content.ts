export default defineContentScript({
  matches: ["https://leetcode.com/problems/*"],
  main() {
    // 1. STATE VARIABLES (Closure Scope)
    let isSubmitting: boolean = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    // 2. HELPER FUNCTIONS
    const checkForSuccess = () => {
      // ... implement Logic 4 here ...
      // If found, reset isSubmitting = false
      const resultContainer = document.querySelector(
        '[data-e2e-locator="submission-result"]',
      );
      const text = resultContainer?.textContent || "";
      if (text.includes("Accepted")) {
        console.log("✅ Success Detected!");
        isSubmitting = false; // Disarm the trap

        // TODO: Send message to background script
        // browser.runtime.sendMessage(...)


      } else if (text.includes("Wrong Answer") || text.includes("Error")) {
        console.log("❌ Failed attempt.");
        isSubmitting = false; // Disarm the trap
      }
    };

    // 3. THE TRIGGER (Logic 1)
    document.addEventListener("click", (e) => {
      // ... check for "Submit" button ...
      // isSubmitting = true;
      const target = e.target as HTMLElement;
      const submitButton = target.closest("button");
      if (
        submitButton &&
        (submitButton.textContent?.includes("Submit") ||
          submitButton.getAttribute("data-e2e-locator") ===
            "console-submit-button")
      ) {
        isSubmitting = true;
        // we check success.
        setTimeout(() => (isSubmitting = false), 15000);
      }
    });

    // 4. THE OBSERVER (Logic 2 & 3)

    const observer = new MutationObserver(() => {
      if (!isSubmitting) return;
      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        checkForSuccess();
      }, 1000);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  },
});
