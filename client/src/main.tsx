import { createRoot } from "react-dom/client";

// Minimal test first
function TestApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>React Test App</h1>
      <p>If you see this, React is working!</p>
      <button onClick={() => alert('Working!')}>Click Me</button>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  console.log('Root element found, rendering React app...');
  createRoot(root).render(<TestApp />);
} else {
  console.error("Root element not found!");
  document.body.innerHTML = '<h1>ERROR: Root element not found</h1>';
}
