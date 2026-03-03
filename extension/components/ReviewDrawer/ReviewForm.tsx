import { useState, useEffect } from "react";
import { browser } from "wxt/browser";

export default function ReviewForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // 1. Define the listener
    const messageListener = (message: any) => {
      if (message.action === "SHOW_REVIEW_DRAWER") {
        console.log("📬 Drawer received data:", message.payload);
        setData(message.payload);
        setIsOpen(true);
      }
    };

    // 2. Subscribe
    browser.runtime.onMessage.addListener(messageListener);

    // 3. Cleanup (Good practice, though content scripts rarely unmount)
    return () => browser.runtime.onMessage.removeListener(messageListener);
  }, []);

  if (!isOpen) return null; // Render nothing if closed

  return (
    <div className="fixed top-0 right-0 h-screen w-[400px] bg-white shadow-2xl z-[99999] p-6 slide-in-animation">
      <h2 className="text-xl font-bold mb-4">Submission Accepted! 🎉</h2>

      {/* The Data from Background */}
      <div className="bg-gray-100 p-3 rounded mb-4">
        <p>
          <strong>Problem:</strong> {data?.problemTitle}
        </p>
        <p>
          <strong>Runtime:</strong> {data?.runtime}
        </p>
      </div>

      <button
        onClick={() => setIsOpen(false)}
        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
      >
        Close
      </button>
    </div>
  );
}
