"use client";

// A submit button that asks for confirmation before allowing its form to submit.
// Used on irreversible/consequential admin actions (suspend, decline, cancel, year-end).
export function ConfirmSubmit({ children, message, className }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
