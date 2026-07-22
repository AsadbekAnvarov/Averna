"use client";

import { motion } from "framer-motion";

/**
 * Global page transition. A `template` (unlike `layout`) re-mounts on every
 * navigation, so this gives a subtle, premium fade between pages.
 *
 * NOTE: we animate OPACITY ONLY (no transform). A lingering `transform` would
 * establish a containing block and break the many `position: fixed` elements in
 * the app (toasts, mobile nav, modals, the level-up overlay). Opacity is safe.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
