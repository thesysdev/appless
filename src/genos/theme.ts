/**
 * Shell-facing theme entry point. Cupertino tokens are the iOS/web/default
 * shell theme; on Android, Metro resolves theme.android.ts instead, which
 * remaps Material 3 tokens onto the same CdsTheme shape. Per-design-system
 * themes live next to their renderer sets under ui/<design-system>/theme.ts.
 */
export * from "./ui/cupertino/theme";
