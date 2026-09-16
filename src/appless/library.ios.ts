import { buildApplessLibrary } from "./ui/contract";
import { cupertinoRenderers } from "./ui/cupertino";

/** iOS build: the Cupertino design language. */
export const applessLibrary = buildApplessLibrary(cupertinoRenderers);
