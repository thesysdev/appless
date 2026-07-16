/**
 * Material 3 renderers for the GenOS contract - the Android counterpart to the
 * Cupertino set. Component names and schemas live in ../contract.tsx.
 */
import { useTriggerAction } from "@openuidev/react-lang";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useTap } from "../shared/actions";
import { createImg } from "../shared/media";
import type {
  BubblesProps,
  CardHeaderProps,
  CardProps,
  ChipsProps,
  HeroStatProps,
  ImageBlockProps,
  KVListProps,
  ListBlockProps,
  ListItemProps,
  PhotoGridProps,
  Renderer,
  StatTilesProps,
  TabsProps,
  TextCalloutProps,
  TextContentProps,
  ToggleProps,
} from "../contract";
import { LucideIcon } from "../icons";
import { useMd } from "./theme";

const Img = createImg(() => useMd().surfaceContainerHigh);

function TonalIcon({ name }: { name: string }) {
  const t = useMd();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: t.secondaryContainer,
      }}
    >
      <LucideIcon name={name} size={19} strokeWidth={2} color={t.onSecondaryContainer} />
    </View>
  );
}

// Root
export const Card: Renderer<CardProps> = ({ props, renderNode }) => (
  <View style={{ gap: 16, paddingBottom: 8 }}>{renderNode(props.children)}</View>
);

// Text & headers
export const CardHeader: Renderer<CardHeaderProps> = ({ props }) => {
  const t = useMd();
  return (
    <View style={{ paddingTop: 4, paddingHorizontal: 4 }}>
      {!!props.subtitle && (
        <Text
          style={{
            marginBottom: 2,
            fontSize: 12,
            fontWeight: "500",
            letterSpacing: 0.5,
            color: t.primary,
          }}
        >
          {props.subtitle}
        </Text>
      )}
      <Text style={{ fontSize: 28, fontWeight: "400", lineHeight: 36, color: t.onSurface }}>
        {props.title}
      </Text>
    </View>
  );
};

const TEXT_STYLES = {
  small: { fontSize: 12.5, lineHeight: 18 },
  default: { fontSize: 15, lineHeight: 22 },
  large: { fontSize: 17, lineHeight: 24 },
  "small-heavy": { fontSize: 13, lineHeight: 19, fontWeight: "500" as const },
  "large-heavy": {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "500" as const,
    marginBottom: -6,
  },
};

export const TextContent: Renderer<TextContentProps> = ({ props }) => {
  const t = useMd();
  const key = (props.style ?? "default") as keyof typeof TEXT_STYLES;
  const style = TEXT_STYLES[key] ?? TEXT_STYLES.default;
  return (
    <Text
      style={[
        { paddingHorizontal: 4, color: key === "small" ? t.onSurfaceVariant : t.onSurface },
        style,
      ]}
    >
      {props.text}
    </Text>
  );
};

const CALLOUT_ICON: Record<string, string> = {
  neutral: "info",
  info: "info",
  success: "circle-check",
  warning: "triangle-alert",
  danger: "octagon-alert",
};

export const TextCallout: Renderer<TextCalloutProps> = ({ props }) => {
  const t = useMd();
  const variant = props.variant ?? "neutral";
  const palette =
    variant === "info"
      ? { bg: t.secondaryContainer, fg: t.onSecondaryContainer }
      : variant === "success"
        ? { bg: t.successContainer, fg: t.dark ? "#C6EFC9" : "#0A3D18" }
        : variant === "warning"
          ? { bg: t.warningContainer, fg: t.onWarningContainer }
          : variant === "danger"
            ? { bg: t.errorContainer, fg: t.onErrorContainer }
            : { bg: t.surfaceContainerHigh, fg: t.onSurface };
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-start",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: palette.bg,
      }}
    >
      <View style={{ marginTop: 1 }}>
        <LucideIcon name={CALLOUT_ICON[variant]} size={20} color={palette.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", lineHeight: 20, color: palette.fg }}>
          {props.title}
        </Text>
        {!!props.description && (
          <Text style={{ marginTop: 2, fontSize: 13, lineHeight: 18, color: palette.fg, opacity: 0.85 }}>
            {props.description}
          </Text>
        )}
      </View>
    </View>
  );
};

// Lists
export const ListItem: Renderer<ListItemProps> = ({ props }) => {
  const t = useMd();
  const onTap = useTap(props.title, props.action);
  const leading = props.leading;
  return (
    <Pressable
      onPress={onTap}
      disabled={!onTap}
      android_ripple={onTap ? { color: t.ripple } : undefined}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingVertical: 10,
        paddingHorizontal: 16,
        minHeight: 56,
        backgroundColor: pressed && onTap ? t.ripple : "transparent",
      })}
    >
      {typeof leading === "string" && leading ? (
        <TonalIcon name={leading} />
      ) : leading && typeof leading === "object" && leading.src ? (
        <Img
          uri={leading.src}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.surfaceContainerHigh }}
        />
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 16, fontWeight: "400", lineHeight: 24, color: t.onSurface }}
        >
          {props.title}
        </Text>
        {!!props.subtitle && (
          <Text
            numberOfLines={1}
            style={{ fontSize: 13.5, lineHeight: 19, color: t.onSurfaceVariant }}
          >
            {props.subtitle}
          </Text>
        )}
      </View>
      {!!props.trailing && (
        <Text
          style={{
            fontSize: 12,
            fontWeight: "500",
            color: t.onSurfaceVariant,
            fontVariant: ["tabular-nums"],
          }}
        >
          {props.trailing}
        </Text>
      )}
    </Pressable>
  );
};

export const Toggle: Renderer<ToggleProps> = ({ props }) => {
  const t = useMd();
  const [override, setOverride] = useState<boolean | null>(null);
  const on = override ?? !!props.on;
  return (
    <Pressable
      onPress={() => setOverride(!on)}
      android_ripple={{ color: t.ripple }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingVertical: 10,
        paddingHorizontal: 16,
        minHeight: 56,
      }}
    >
      {!!props.icon && <TonalIcon name={props.icon} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 16, fontWeight: "400", lineHeight: 24, color: t.onSurface }}
        >
          {props.title}
        </Text>
        {!!props.subtitle && (
          <Text
            numberOfLines={1}
            style={{ fontSize: 13.5, lineHeight: 19, color: t.onSurfaceVariant }}
          >
            {props.subtitle}
          </Text>
        )}
      </View>
      <Switch
        value={on}
        onValueChange={(v) => setOverride(v)}
        trackColor={{ false: t.surfaceContainerHigh, true: t.primary }}
        thumbColor={on ? t.onPrimary : t.outline}
      />
    </Pressable>
  );
};

function GroupHeader({ text }: { text: string }) {
  const t = useMd();
  return (
    <Text
      style={{
        marginBottom: 8,
        marginLeft: 16,
        fontSize: 14,
        fontWeight: "500",
        color: t.primary,
      }}
    >
      {text}
    </Text>
  );
}

export const ListBlock: Renderer<ListBlockProps> = ({ props, renderNode }) => {
  const t = useMd();
  const items = (Array.isArray(props.items) ? props.items : []).filter(Boolean);
  return (
    <View>
      {!!props.header && <GroupHeader text={props.header} />}
      <View
        style={{
          backgroundColor: t.surfaceContainer,
          borderRadius: 12,
          overflow: "hidden",
          paddingVertical: 4,
        }}
      >
        {items.map((item, i) => (
          <React.Fragment key={i}>{renderNode(item)}</React.Fragment>
        ))}
      </View>
    </View>
  );
};

export const KVList: Renderer<KVListProps> = ({ props }) => {
  const t = useMd();
  const rows = (props.rows ?? []).filter(Boolean);
  return (
    <View>
      {!!props.header && <GroupHeader text={props.header} />}
      <View
        style={{
          backgroundColor: t.surfaceContainer,
          borderRadius: 12,
          overflow: "hidden",
          paddingVertical: 6,
        }}
      >
        {rows.map((r, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 16,
              paddingVertical: 9,
              paddingHorizontal: 16,
            }}
          >
            <Text style={{ fontSize: 14, color: t.onSurfaceVariant }}>{r.label}</Text>
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: "500",
                textAlign: "right",
                color: t.onSurface,
                fontVariant: ["tabular-nums"],
              }}
            >
              {r.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// Stats & numbers
export const HeroStat: Renderer<HeroStatProps> = ({ props }) => {
  const t = useMd();
  return (
    <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 2 }}>
      {!!props.label && (
        <Text
          style={{
            marginBottom: 2,
            fontSize: 12,
            fontWeight: "500",
            letterSpacing: 0.5,
            color: t.onSurfaceVariant,
          }}
        >
          {props.label}
        </Text>
      )}
      <Text
        style={{
          fontSize: 57,
          fontWeight: "400",
          lineHeight: 64,
          color: t.onSurface,
          fontVariant: ["tabular-nums"],
        }}
      >
        {props.value}
      </Text>
      {!!props.sublabel && (
        <Text style={{ marginTop: 2, fontSize: 14, color: t.onSurfaceVariant }}>
          {props.sublabel}
        </Text>
      )}
    </View>
  );
};

export const StatTiles: Renderer<StatTilesProps> = ({ props }) => {
  const t = useMd();
  const items = (Array.isArray(props.items) ? props.items : []).filter(Boolean);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {items.map((it, i) => {
        const deltaColor = it.delta?.trim().startsWith("-")
          ? t.error
          : it.delta?.trim().startsWith("+")
            ? t.success
            : t.onSurfaceVariant;
        return (
          <View
            key={i}
            style={{
              flexGrow: 1,
              flexBasis: "45%",
              backgroundColor: t.surfaceContainer,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {!!it.icon && (
                <LucideIcon name={it.icon} size={14} strokeWidth={2} color={t.onSurfaceVariant} />
              )}
              <Text style={{ fontSize: 12, fontWeight: "500", color: t.onSurfaceVariant }}>
                {it.label}
              </Text>
            </View>
            <View style={{ marginTop: 4, flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 22,
                  fontWeight: "500",
                  color: t.onSurface,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {it.value}
              </Text>
              {!!it.delta && (
                <Text style={{ fontSize: 12, fontWeight: "500", color: deltaColor }}>
                  {it.delta}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

// Media
export const ImageBlock: Renderer<ImageBlockProps> = ({ props }) => {
  const t = useMd();
  return (
    <View
      style={{
        borderRadius: 16,
        overflow: "hidden",
        aspectRatio: 16 / 9,
        backgroundColor: t.surfaceContainerHigh,
      }}
    >
      <Img uri={props.src} style={{ width: "100%", height: "100%" }} />
      {!!props.caption && (
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.62)"]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingTop: 28,
            paddingHorizontal: 16,
            paddingBottom: 12,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "500" }}>{props.caption}</Text>
        </LinearGradient>
      )}
    </View>
  );
};

export const PhotoGrid: Renderer<PhotoGridProps> = ({ props }) => {
  const t = useMd();
  const images = (props.images ?? []).filter((im) => im?.src);
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 3,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: t.surfaceContainerHigh,
      }}
    >
      {images.map((im, i) => (
        <Img key={i} uri={im.src} style={{ flexGrow: 1, flexBasis: "31%", aspectRatio: 1 }} />
      ))}
    </View>
  );
};

// Messaging
export const Bubbles: Renderer<BubblesProps> = ({ props }) => {
  const t = useMd();
  const messages = (props.messages ?? []).filter((m) => m?.text);
  return (
    <View style={{ gap: 4, paddingHorizontal: 2 }}>
      {messages.map((m, i) => (
        <React.Fragment key={i}>
          {!!m.time && (
            <Text
              style={{
                marginTop: 8,
                marginBottom: 3,
                textAlign: "center",
                fontSize: 11,
                fontWeight: "500",
                color: t.onSurfaceVariant,
              }}
            >
              {m.time}
            </Text>
          )}
          <View
            style={{
              maxWidth: "78%",
              paddingVertical: 9,
              paddingHorizontal: 14,
              borderRadius: 18,
              alignSelf: m.me ? "flex-end" : "flex-start",
              backgroundColor: m.me ? t.primaryContainer : t.surfaceContainerHigh,
              borderBottomRightRadius: m.me ? 4 : 18,
              borderBottomLeftRadius: m.me ? 18 : 4,
            }}
          >
            <Text
              style={{
                fontSize: 14.5,
                lineHeight: 20,
                color: m.me ? t.onPrimaryContainer : t.onSurface,
              }}
            >
              {m.text}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
};

// Chips & tabs
export const Chips: Renderer<ChipsProps> = ({ props }) => {
  const t = useMd();
  const triggerAction = useTriggerAction();
  const [active, setActive] = useState(0);
  const labels = (props.labels ?? []).filter(Boolean);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -16 }}
      contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingHorizontal: 16 }}
    >
      {labels.map((l, i) => {
        const selected = i === active;
        return (
          <Pressable
            key={i}
            onPress={() => {
              if (selected) return;
              setActive(i);
              // Chips act as live filters, not actions: the selected label
              // becomes a filter request against the current screen.
              triggerAction(
                `Apply the "${l}" filter and re-render this screen with only matching content`,
                undefined,
                undefined,
              );
            }}
            android_ripple={{ color: t.ripple }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 32,
              paddingHorizontal: selected ? 12 : 14,
              borderRadius: 8,
              backgroundColor: selected ? t.secondaryContainer : "transparent",
              borderWidth: selected ? 0 : 1,
              borderColor: t.outline,
            }}
          >
            {selected && (
              <LucideIcon name="check" size={15} strokeWidth={2.4} color={t.onSecondaryContainer} />
            )}
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                color: selected ? t.onSecondaryContainer : t.onSurfaceVariant,
              }}
            >
              {l}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

export const Tabs: Renderer<TabsProps> = ({ props, renderNode }) => {
  const t = useMd();
  const [active, setActive] = useState(0);
  const items = (Array.isArray(props.items) ? props.items : []).filter(Boolean) as Array<{
    props?: { label?: string; children?: unknown };
  }>;
  const current = items[Math.min(active, Math.max(items.length - 1, 0))];
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: t.outlineVariant,
        }}
      >
        {items.map((it, i) => (
          <Pressable
            key={i}
            onPress={() => setActive(i)}
            android_ripple={{ color: t.ripple }}
            style={{ flex: 1, alignItems: "center", paddingTop: 10, paddingHorizontal: 4 }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                fontWeight: "500",
                color: i === active ? t.primary : t.onSurfaceVariant,
              }}
            >
              {it.props?.label ?? `Tab ${i + 1}`}
            </Text>
            <View
              style={{
                marginTop: 9,
                height: 3,
                alignSelf: "stretch",
                marginHorizontal: 18,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
                backgroundColor: i === active ? t.primary : "transparent",
              }}
            />
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 14, gap: 16 }}>
        {current ? renderNode(current.props?.children) : null}
      </View>
    </View>
  );
};
