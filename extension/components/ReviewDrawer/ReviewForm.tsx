export default function ReviewForm() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "400px",
        height: "100vh",
        background: "white",
        boxShadow: "0 0 20px rgba(0,0,0,0.3)",
        zIndex: 2147483647,
        padding: "24px",
      }}
    >
      <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem" }}>
        Review drawer
      </h2>
      <p>If you see this, the drawer is showing.</p>
    </div>
  );
}