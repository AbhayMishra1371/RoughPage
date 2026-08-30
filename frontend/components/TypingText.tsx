"use client";

import { useEffect, useState } from "react";

/**
 * Types its message character by character with a caret, like someone
 * writing the status line by hand. Respects reduced motion (instant).
 */
export default function TypingText({ message }: { message: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(message.length);
      return;
    }
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= message.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 24);
    return () => clearInterval(id);
  }, [message]);

  const done = shown >= message.length;

  return (
    <span aria-label={message}>
      <span aria-hidden="true">
        {message.slice(0, shown)}
        {!done && <span className="animate-pulse">|</span>}
      </span>
    </span>
  );
}
