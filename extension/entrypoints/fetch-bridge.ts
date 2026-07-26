import { installFetchBridge } from "@/lib/leetcode/bridge";

export default defineUnlistedScript(() => {
  const scriptTag = document.currentScript as HTMLScriptElement;
  const { token, clientId } = scriptTag.dataset;
  if (!token || !clientId) return;
  installFetchBridge({ token, clientId });
});
