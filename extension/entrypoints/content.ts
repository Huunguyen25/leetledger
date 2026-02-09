export default defineContentScript({
  matches: ["*://*.leetcode.com/*"],
  main() {
    console.log("Hello content script!");
  },
});
