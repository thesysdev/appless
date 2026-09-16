import { buildApplessLibrary } from "./ui/contract";
import { materialRenderers } from "./ui/material";

/** Android build: the Material 3 design language. */
export const applessLibrary = buildApplessLibrary(materialRenderers);
