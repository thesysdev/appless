/**
 * Cupertino (iOS) renderers for the GenOS contract. Render functions only -
 * component names, prop schemas and descriptions live in ../contract.tsx.
 */
import { useTriggerAction } from "@openuidev/react-lang";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { iconTint, LucideIcon } from "../icons";
import { useCds } from "./theme";

const HAIR = StyleSheet.hairlineWidth;

/** Rounded icon badge - the iOS settings-row look. */
function IconBadge({ name }: { name: string }) {
  return (
    <View
      style={{
        width: 29,
        height: 29,
        borderRadius: 7,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: iconTint(name),
      }}
    >
      <LucideIcon name={name} size={15} strokeWidth={2.2} color="#fff" />
    </View>
  );
}

const Img = createImg(() => useCds().fill);

// Root
export const Card: Renderer<CardProps> = ({ props, renderNode }) => (
  <View style={{ gap: 15, paddingBottom: 8 }}>{renderNode(props.children)}</View>
);

// Text & headers
export const CardHeader: Renderer<CardHeaderProps> = ({ props }) => {
  const t = useCds();
  return (
    <View style={{ paddingTop: 18, paddingBottom: 14, paddingHorizontal: 2 }}>
      {!!props.subtitle && (
        <Text
          style={{
            marginBottom: 1,
            fontSize: 12,
            fontWeight: "600",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: t.ink2,
          }}
        >
          {props.subtitle}
        </Text>
      )}
      <Text
        style={{
          fontSize: 56,
          fontWeight: "300",
          letterSpacing: -1.5,
          lineHeight: 60,
          color: t.ink,
        }}
      >
        {props.title}
      </Text>
    </View>
  );
};

const TEXT_STYLES = {
  small: { fontSize: 12.5, lineHeight: 18 },
  default: { fontSize: 15, lineHeight: 22 },
  large: { fontSize: 17, lineHeight: 24 },
  "small-heavy": { fontSize: 13, lineHeight: 19, fontWeight: "600" as const },
  "large-heavy": {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
    marginBottom: -6,
  },
};

export const TextContent: Renderer<TextContentProps> = ({ props }) => {
  const t = useCds();
  const key = (props.style ?? "default") as keyof typeof TEXT_STYLES;
  const style = TEXT_STYLES[key] ?? TEXT_STYLES.default;
  return (
    <Text style={[{ paddingHorizontal: 2, color: key === "small" ? t.ink2 : t.ink }, style]}>
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
  const t = useCds();
  const variant = props.variant ?? "neutral";
  const iconBg =
    variant === "info"
      ? t.tint
      : variant === "success"
        ? t.green
        : variant === "warning"
          ? "#ff9f0a"
          : variant === "danger"
            ? t.red
            : "#8e8e93";
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 11,
        alignItems: "flex-start",
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: t.group,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: iconBg,
          marginTop: 1,
        }}
      >
        <LucideIcon name={CALLOUT_ICON[variant]} size={16} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", lineHeight: 19, color: t.ink }}>
          {props.title}
        </Text>
        {!!props.description && (
          <Text style={{ marginTop: 1, fontSize: 13, lineHeight: 18, color: t.ink2 }}>
            {props.description}
          </Text>
        )}
      </View>
    </View>
  );
};

// Lists
export const ListItem: Renderer<ListItemProps> = ({ props }) => {
  const t = useCds();
  const onTap = useTap(props.title, props.action);
  const leading = props.leading;
  return (
    <Pressable
      onPress={onTap}
      disabled={!onTap}
      style={({ pressed }) => [styles.row, pressed && onTap ? { backgroundColor: t.fill } : null]}
    >
      {typeof leading === "string" && leading ? (
        <IconBadge name={leading} />
      ) : leading && typeof leading === "object" && leading.src ? (
        <Img
          uri={leading.src}
          style={{ width: 42, height: 42, borderRadius: 9, backgroundColor: t.fill }}
        />
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 15, fontWeight: "500", lineHeight: 20, color: t.ink }}
        >
          {props.title}
        </Text>
        {!!props.subtitle && (
          <Text
            numberOfLines={1}
            style={{ marginTop: 1, fontSize: 12.5, lineHeight: 17, color: t.ink2 }}
          >
            {props.subtitle}
          </Text>
        )}
      </View>
      {!!props.trailing && (
        <Text style={{ fontSize: 14.5, color: t.ink2, fontVariant: ["tabular-nums"] }}>
          {props.trailing}
        </Text>
      )}
      {onTap && (
        <View style={{ marginLeft: -4 }}>
          <LucideIcon name="chevron-right" size={16} strokeWidth={2.4} color={t.ink3} />
        </View>
      )}
    </Pressable>
  );
};

export const Toggle: Renderer<ToggleProps> = ({ props }) => {
  const t = useCds();
  const [override, setOverride] = useState<boolean | null>(null);
  const on = override ?? !!props.on;
  return (
    <Pressable
      onPress={() => setOverride(!on)}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={styles.row}
    >
      {!!props.icon && <IconBadge name={props.icon} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 15, fontWeight: "500", lineHeight: 20, color: t.ink }}
        >
          {props.title}
        </Text>
        {!!props.subtitle && (
          <Text
            numberOfLines={1}
            style={{ marginTop: 1, fontSize: 12.5, lineHeight: 17, color: t.ink2 }}
          >
            {props.subtitle}
          </Text>
        )}
      </View>
      <View
        style={{
          width: 47,
          height: 28,
          borderRadius: 15,
          backgroundColor: on ? t.green : t.fill,
          padding: 2,
          alignItems: on ? "flex-end" : "flex-start",
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: "#fff",
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 2.5,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        />
      </View>
    </Pressable>
  );
};

/** Inset iOS separator between grouped rows. */
function Separator() {
  const t = useCds();
  return <View style={{ height: HAIR, marginLeft: 16, backgroundColor: t.sep }} />;
}

function GroupHeader({ text }: { text: string }) {
  const t = useCds();
  return (
    <Text
      style={{
        marginBottom: 7,
        marginLeft: 16,
        fontSize: 12,
        fontWeight: "600",
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: t.ink2,
      }}
    >
      {text}
    </Text>
  );
}

export const ListBlock: Renderer<ListBlockProps> = ({ props, renderNode }) => {
  const t = useCds();
  const items = (Array.isArray(props.items) ? props.items : []).filter(Boolean);
  return (
    <View>
      {!!props.header && <GroupHeader text={props.header} />}
      <View style={{ backgroundColor: t.group, borderRadius: 14, overflow: "hidden" }}>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Separator />}
            {renderNode(item)}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

export const KVList: Renderer<KVListProps> = ({ props }) => {
  const t = useCds();
  const rows = (props.rows ?? []).filter(Boolean);
  return (
    <View>
      {!!props.header && <GroupHeader text={props.header} />}
      <View style={{ backgroundColor: t.group, borderRadius: 14, overflow: "hidden" }}>
        {rows.map((r, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Separator />}
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 14,
                paddingVertical: 11,
                paddingHorizontal: 16,
              }}
            >
              <Text style={{ fontSize: 14, color: t.ink2 }}>{r.label}</Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: 14.5,
                  fontWeight: "500",
                  textAlign: "right",
                  color: t.ink,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {r.value}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

// Stats & numbers
export const HeroStat: Renderer<HeroStatProps> = ({ props }) => {
  const t = useCds();
  return (
    <View style={{ alignItems: "center", paddingTop: 6, paddingBottom: 2 }}>
      {!!props.label && (
        <Text
          style={{
            marginBottom: 2,
            fontSize: 12,
            fontWeight: "600",
            letterSpacing: 1,
            textTransform: "uppercase",
            color: t.ink2,
          }}
        >
          {props.label}
        </Text>
      )}
      <Text
        style={{
          fontSize: 56,
          fontWeight: "300",
          letterSpacing: -1.5,
          lineHeight: 60,
          color: t.ink,
          fontVariant: ["tabular-nums"],
        }}
      >
        {props.value}
      </Text>
      {!!props.sublabel && (
        <Text style={{ marginTop: 3, fontSize: 14, fontWeight: "500", color: t.ink2 }}>
          {props.sublabel}
        </Text>
      )}
    </View>
  );
};

export const StatTiles: Renderer<StatTilesProps> = ({ props }) => {
  const t = useCds();
  const items = (Array.isArray(props.items) ? props.items : []).filter(Boolean);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {items.map((it, i) => {
        const deltaColor = it.delta?.trim().startsWith("-")
          ? t.red
          : it.delta?.trim().startsWith("+")
            ? t.green
            : t.ink2;
        return (
          <View
            key={i}
            style={{
              flexGrow: 1,
              flexBasis: "45%",
              backgroundColor: t.group,
              borderRadius: 14,
              paddingVertical: 11,
              paddingHorizontal: 13,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              {!!it.icon && (
                <LucideIcon name={it.icon} size={13} strokeWidth={2.2} color={t.ink2} />
              )}
              <Text style={{ fontSize: 12, fontWeight: "600", color: t.ink2 }}>{it.label}</Text>
            </View>
            <View style={{ marginTop: 3, flexDirection: "row", alignItems: "baseline", gap: 7 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 21,
                  fontWeight: "700",
                  letterSpacing: -0.4,
                  color: t.ink,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {it.value}
              </Text>
              {!!it.delta && (
                <Text style={{ fontSize: 12, fontWeight: "600", color: deltaColor }}>
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
  const t = useCds();
  return (
    <View
      style={{
        borderRadius: 16,
        overflow: "hidden",
        aspectRatio: 16 / 9,
        backgroundColor: t.fill,
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
            paddingTop: 26,
            paddingHorizontal: 14,
            paddingBottom: 11,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 15,
              fontWeight: "600",
              letterSpacing: -0.2,
              textShadowColor: "rgba(0,0,0,0.4)",
              textShadowRadius: 3,
              textShadowOffset: { width: 0, height: 1 },
            }}
          >
            {props.caption}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
};

export const PhotoGrid: Renderer<PhotoGridProps> = ({ props }) => {
  const t = useCds();
  const images = (props.images ?? []).filter((im) => im?.src);
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 2.5,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: t.fill,
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
  const t = useCds();
  const messages = (props.messages ?? []).filter((m) => m?.text);
  return (
    <View style={{ gap: 3, paddingHorizontal: 2 }}>
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
                color: t.ink2,
              }}
            >
              {m.time}
            </Text>
          )}
          <View
            style={{
              maxWidth: "78%",
              paddingVertical: 8,
              paddingHorizontal: 13,
              borderRadius: 18,
              alignSelf: m.me ? "flex-end" : "flex-start",
              backgroundColor: m.me ? t.tint : t.bubble,
              borderBottomRightRadius: m.me ? 6 : 18,
              borderBottomLeftRadius: m.me ? 18 : 6,
            }}
          >
            <Text style={{ fontSize: 14.5, lineHeight: 20, color: m.me ? "#fff" : t.ink }}>
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
  const t = useCds();
  const triggerAction = useTriggerAction();
  const [active, setActive] = useState(0);
  const labels = (props.labels ?? []).filter(Boolean);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -14 }}
      contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingHorizontal: 14 }}
    >
      {labels.map((l, i) => (
        <Pressable
          key={i}
          onPress={() => {
            if (i === active) return;
            setActive(i);
            // Chips are live filters: no explicit action needed - the label
            // becomes a filter request against the current screen's context.
            triggerAction(
              `Apply the "${l}" filter and re-render this screen with only matching content`,
              undefined,
              undefined,
            );
          }}
          style={{
            paddingVertical: 7,
            paddingHorizontal: 14,
            borderRadius: 17,
            backgroundColor: i === active ? t.ink : t.group,
            borderWidth: i === active ? 0 : HAIR,
            borderColor: t.sep,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: i === active ? t.bg : t.ink,
            }}
          >
            {l}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
};

export const Tabs: Renderer<TabsProps> = ({ props, renderNode }) => {
  const t = useCds();
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
          gap: 2,
          padding: 2,
          borderRadius: 10,
          backgroundColor: t.fill,
        }}
      >
        {items.map((it, i) => (
          <Pressable
            key={i}
            onPress={() => setActive(i)}
            style={{
              flex: 1,
              paddingVertical: 6,
              paddingHorizontal: 4,
              borderRadius: 8,
              backgroundColor: i === active ? t.group : "transparent",
              ...(i === active
                ? {
                    shadowColor: "#000",
                    shadowOpacity: 0.12,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 2,
                  }
                : null),
            }}
          >
            <Text
              numberOfLines={1}
              style={{ textAlign: "center", fontSize: 13, fontWeight: "600", color: t.ink }}
            >
              {it.props?.label ?? `Tab ${i + 1}`}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 12, gap: 14 }}>
        {current ? renderNode(current.props?.children) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 11,
    paddingBottom: 11,
    paddingLeft: 16,
    paddingRight: 14,
    minHeight: 46,
  },
});
