import { useLayoutEffect, useRef, useState } from "react";

type Props = { children: React.ReactNode; className?: string };

/**
 * Fixed page header that stays put while the page scrolls.
 * It renders a spacer with the header's measured height so content
 * below doesn't jump.
 */
export default function StickyPageHeader({ children, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(64);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => setH(el.offsetHeight || 64);

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <>
      {/* spacer to offset fixed header height */}
      <div style={{ height: h }} aria-hidden="true" />
      <div
        ref={ref}
        className={
          "fixed inset-x-0 top-0 z-30 border-b border-slate-200 " +
          "bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 " +
          className
        }
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
      </div>
    </>
  );
}
