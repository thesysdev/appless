import { buildGenosLibrary } from "./ui/contract";
import { cupertinoRenderers } from "./ui/cupertino";

/**
 * Default library build (also what jest resolves). Platform-specific builds
 * (library.ios.ts / library.android.ts) override this per bundle once more
 * than one design system exists.
 */
export const genosLibrary = buildGenosLibrary(cupertinoRenderers);
