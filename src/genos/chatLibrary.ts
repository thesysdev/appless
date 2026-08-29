/**
 * The component contract as OpenUI Cloud consumes it: a `chatLibrary` wire
 * object (root + JSON schema + groups) derived from the very library the
 * renderer uses, so the Cloud-generated system prompt, its validating parser
 * and the on-device renderer cannot drift apart.
 */
import type { Library } from "@openuidev/react-lang";

/** Echoed back on the response header as `libraryVersion`. */
export const CHAT_LIBRARY_ID = "appless-native-0.1.0";

interface ComponentGroup {
  name: string;
  components: string[];
  notes?: string[];
}

export interface ChatLibrary {
  id: string;
  root: string;
  schema: {
    $defs?: Record<string, { description?: string }>;
  };
  componentGroups?: ComponentGroup[];
}

export function buildChatLibrary(library: Library): ChatLibrary {
  const schema = library.toJSONSchema() as ChatLibrary["schema"];
  const root = library.root;
  if (!root) throw new Error("chatLibrary: the component library has no root component");

  // toJSONSchema() drops the per-component descriptions; the Cloud prompt
  // renders each component as `signature - description`, so fold them back in.
  for (const [name, def] of Object.entries(schema.$defs ?? {})) {
    const description = library.components[name]?.description;
    if (description) def.description = description;
  }

  return {
    id: CHAT_LIBRARY_ID,
    root,
    schema,
    ...(library.componentGroups ? { componentGroups: library.componentGroups } : {}),
  };
}
