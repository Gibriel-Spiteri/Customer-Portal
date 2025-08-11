import { createRoot } from "react-dom/client";

function MinimalApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>React is Working!</h1>
      <p>If you see this, React is loading correctly.</p>
      <button onClick={() => alert('Button clicked!')}>
        Test Button
      </button>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<MinimalApp />);
} else {
  console.error("Root element not found!");
}