/**
 * Graphics tier — `<html data-gfx="full" | "lite">`.
 *
 * "lite" switches off the heavier decorative effects (aurora drift, pointer
 * spotlight, scroll reveals) so the app stays smooth on modest devices. The
 * tier is decided before first paint by GFX_TIER_SCRIPT (inlined in the root
 * layout's <head>):
 *
 *   lite  ← prefers-reduced-motion, Save-Data, deviceMemory ≤ 4 GB,
 *           hardwareConcurrency ≤ 4, or < 40 FPS measured over the first 2 s
 *   full  ← everything else
 *
 * CSS keys off `html[data-gfx="lite"]` (see "Motion system" in globals.css);
 * client components read it at use time via motionDisabled(), so a late switch
 * to "lite" from the FPS probe takes effect immediately.
 *
 * Plain module (no React, no "use client") — safe for server and client code.
 */

export type GfxTier = "full" | "lite";

/** sessionStorage key: a slow FPS measurement is remembered for the tab session. */
export const GFX_SESSION_KEY = "av-gfx";

/**
 * Tiny ES5 inline script. Never throws; skips the FPS probe when the page loads
 * in a background tab or becomes hidden mid-probe (rAF is paused there, which
 * would read as a false "slow device"). A measured "lite" is remembered for the
 * tab session, so later full reloads start in lite straight away.
 */
export const GFX_TIER_SCRIPT = `(function(){try{var d=document.documentElement,n=navigator,c=n.connection||{},w=window,k="${GFX_SESSION_KEY}",ss=null;try{ss=w.sessionStorage}catch(e){}var lite=!!(w.matchMedia&&w.matchMedia("(prefers-reduced-motion: reduce)").matches)||c.saveData===true||(n.deviceMemory>0&&n.deviceMemory<=4)||(n.hardwareConcurrency>0&&n.hardwareConcurrency<=4)||!!(ss&&ss.getItem(k)==="lite");d.setAttribute("data-gfx",lite?"lite":"full");if(lite||!w.requestAnimationFrame||document.hidden)return;var s=0,f=0,off=0;document.addEventListener("visibilitychange",function(){off=1});var tick=function(t){if(off)return;if(!s)s=t;f++;if(t-s<2000){w.requestAnimationFrame(tick)}else if(f*1000/(t-s)<40){d.setAttribute("data-gfx","lite");try{ss&&ss.setItem(k,"lite")}catch(e){}}};w.requestAnimationFrame(tick)}catch(e){}})();`;

/** Current tier ("full" on the server or when the script didn't run). */
export function readGfxTier(): GfxTier {
  if (typeof document === "undefined") return "full";
  return document.documentElement.getAttribute("data-gfx") === "lite" ? "lite" : "full";
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** True when decorative motion should be skipped (lite tier or reduced motion). */
export function motionDisabled(): boolean {
  return readGfxTier() === "lite" || prefersReducedMotion();
}
