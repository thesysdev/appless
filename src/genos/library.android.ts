import { buildGenosLibrary } from "./ui/contract";
import { materialRenderers } from "./ui/material";

/** Android build: the Material 3 design language. */
export const genosLibrary = buildGenosLibrary(materialRenderers);
