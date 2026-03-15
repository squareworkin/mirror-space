import './GradientOrbs.css';

/**
 * GradientOrbs — Soft, blurred color blobs that shift slowly
 * Three orbs with different colors, sizes, and animation speeds
 */
export default function GradientOrbs() {
  return (
    <div className="gradient-orbs" aria-hidden="true">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
    </div>
  );
}
