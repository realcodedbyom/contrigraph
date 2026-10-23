"use client";
import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
export default function WorkspaceMotion({ section }: { section: string }) {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      autoRaf: true,
      duration: 0.65,
      prevent: (node) =>
        Boolean(node.closest(".cg-dialog,.cg-board,.cg-graph,.cg-scroll")),
    });
    return () => lenis.destroy();
  }, []);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const heading = document.querySelector(".cg-heading");
    if (!heading) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        heading,
        { x: 7 },
        { x: 0, duration: 0.24, ease: "power2.out" },
      );
    });
    return () => ctx.revert();
  }, [section]);
  return null;
}
