export default function PublicArrow({
  direction = "up-right",
}: {
  direction?: "up-right" | "right" | "turn-right";
}) {
  const path = {
    "up-right": "M7 17 17 7M7 7h10v10",
    right: "M5 12h14m-6-6 6 6-6 6",
    "turn-right": "M6 4v12h14m-5-5 5 5-5 5",
  }[direction];
  return (
    <svg
      className="public-arrow"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}
