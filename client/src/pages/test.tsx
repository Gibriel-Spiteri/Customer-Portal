export default function TestPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Test Page</h1>
      <p>If you can see this, React is working!</p>
      <p>Current URL: {window.location.href}</p>
      <p>Port: {window.location.port || 'default (80/443)'}</p>
    </div>
  );
}