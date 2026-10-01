export default function Loading({ label = "Loading..." }) {
  return (
    <div className="loading-wrap" role="status">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}
