import { buildGenosLibrary } from "./ui/contract";
import { cupertinoRenderers } from "./ui/cupertino";

/** iOS build: the Cupertino design language. */
export const genosLibrary = buildGenosLibrary(cupertinoRenderers);
