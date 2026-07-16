/** Material 3 form renderers for the GenOS contract. */
import { FormNameContext, useFormName, useTriggerAction } from "@openuidev/react-lang";
import type { ActionPlan } from "@openuidev/react-lang";
import RNSlider from "@react-native-community/slider";
import React, { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { readSelectItems, textInputBehaviorProps, useFieldState } from "../shared/forms";
import type {
  ButtonProps,
  ButtonsProps,
  DatePickerProps,
  FormControlProps,
  FormProps,
  InputProps,
  Renderer,
  SelectProps,
  SliderProps,
  TextAreaProps,
} from "../contract";
import { LucideIcon } from "../icons";
import { useMd } from "./theme";

function useOutlinedStyle(focused: boolean) {
  const t = useMd();
  return {
    backgroundColor: "transparent",
    borderWidth: focused ? 2 : 1,
    borderColor: focused ? t.primary : t.outline,
    borderRadius: 4,
    paddingVertical: focused ? 13 : 14,
    paddingHorizontal: focused ? 15 : 16,
    fontSize: 16,
    color: t.onSurface,
  } as const;
}

export const Input: Renderer<InputProps> = ({ props }) => {
  const t = useMd();
  const field = useFieldState(props.name, "Input", props.value);
  const [focused, setFocused] = useState(false);
  const style = useOutlinedStyle(focused);
  return (
    <TextInput
      style={style}
      placeholder={props.placeholder}
      placeholderTextColor={t.onSurfaceVariant}
      {...textInputBehaviorProps(props.type)}
      cursorColor={t.primary}
      selectionColor={t.primaryContainer}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      value={typeof field.value === "string" ? field.value : ""}
      onChangeText={(text) => field.set(text, false)}
      onEndEditing={(e) => field.set(e.nativeEvent.text, true)}
    />
  );
};

export const TextArea: Renderer<TextAreaProps> = ({ props }) => {
  const t = useMd();
  const field = useFieldState(props.name, "TextArea", props.value);
  const [focused, setFocused] = useState(false);
  const style = useOutlinedStyle(focused);
  const rows = props.rows ?? 4;
  return (
    <TextInput
      style={[style, { minHeight: 28 + rows * 20, textAlignVertical: "top" }]}
      placeholder={props.placeholder}
      placeholderTextColor={t.onSurfaceVariant}
      multiline
      cursorColor={t.primary}
      selectionColor={t.primaryContainer}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      value={typeof field.value === "string" ? field.value : ""}
      onChangeText={(text) => field.set(text, false)}
      onEndEditing={(e) => field.set(e.nativeEvent.text, true)}
    />
  );
};

export const DatePicker: Renderer<DatePickerProps> = ({ props }) => {
  const t = useMd();
  const field = useFieldState(props.name, "DatePicker", props.value);
  const [focused, setFocused] = useState(false);
  const style = useOutlinedStyle(focused);
  return (
    <TextInput
      style={style}
      placeholder={props.mode === "range" ? "YYYY-MM-DD → YYYY-MM-DD" : "YYYY-MM-DD"}
      placeholderTextColor={t.onSurfaceVariant}
      cursorColor={t.primary}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      value={typeof field.value === "string" ? field.value : ""}
      onChangeText={(text) => field.set(text, false)}
      onEndEditing={(e) => field.set(e.nativeEvent.text, true)}
    />
  );
};

// Select
const SELECT_SIZES = {
  small: { paddingVertical: 10, fontSize: 14 },
  medium: { paddingVertical: 14, fontSize: 16 },
  large: { paddingVertical: 18, fontSize: 18 },
} as const;

export const Select: Renderer<SelectProps> = ({ props }) => {
  const t = useMd();
  const field = useFieldState(props.name, "Select", props.value);
  const [open, setOpen] = useState(false);
  const style = useOutlinedStyle(false);
  const size = SELECT_SIZES[props.size ?? "medium"] ?? SELECT_SIZES.medium;
  const items = readSelectItems(props.items);
  const selected = items.find((it) => it.value === field.value);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        android_ripple={{ color: t.ripple }}
        style={[
          style,
          {
            paddingVertical: size.paddingVertical,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          },
        ]}
      >
        <Text style={{ fontSize: size.fontSize, color: selected ? t.onSurface : t.onSurfaceVariant }}>
          {selected?.label ?? props.placeholder ?? "Select…"}
        </Text>
        <LucideIcon name="chevron-down" size={18} color={t.onSurfaceVariant} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "center",
            padding: 36,
          }}
          onPress={() => setOpen(false)}
        >
          <View
            style={{
              backgroundColor: t.surfaceContainerHigh,
              borderRadius: 12,
              overflow: "hidden",
              paddingVertical: 8,
              elevation: 6,
            }}
          >
            {items.map((it, i) => {
              const isSel = it.value === field.value;
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    field.set(it.value, true);
                    setOpen(false);
                  }}
                  android_ripple={{ color: t.ripple }}
                  style={({ pressed }) => ({
                    minHeight: 48,
                    paddingHorizontal: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: pressed ? t.ripple : isSel ? t.secondaryContainer : "transparent",
                  })}
                >
                  <Text style={{ fontSize: 15, color: t.onSurface }}>{it.label ?? it.value}</Text>
                  {isSel && (
                    <LucideIcon name="check" size={17} strokeWidth={2.4} color={t.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

// Slider
export const Slider: Renderer<SliderProps> = ({ props }) => {
  const t = useMd();
  // Seeding the default into form state means an untouched slider still
  // submits its value instead of silently missing from formState.
  const field = useFieldState(
    props.name,
    "Slider",
    props.value ?? props.defaultValue ?? [props.min],
  );
  const current = Array.isArray(field.value)
    ? Number(field.value[0])
    : (props.defaultValue?.[0] ?? props.min);
  return (
    <View style={{ gap: 2 }}>
      {!!props.label && (
        <Text style={{ fontSize: 13, fontWeight: "500", color: t.onSurfaceVariant }}>
          {props.label}
        </Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <RNSlider
        style={{ flex: 1, height: 36 }}
        minimumValue={props.min}
        maximumValue={props.max}
        step={props.variant === "discrete" ? (props.step ?? 1) : 0}
        value={current}
        minimumTrackTintColor={t.primary}
        maximumTrackTintColor={t.surfaceContainerHigh}
        thumbTintColor={t.primary}
        onValueChange={(v) => field.set([v], false)}
        onSlidingComplete={(v) => field.set([v], true)}
      />
      <Text
        style={{
          minWidth: 36,
          textAlign: "right",
          fontSize: 13,
          fontWeight: "500",
          color: t.onSurfaceVariant,
          fontVariant: ["tabular-nums"],
        }}
      >
        {Math.round(current * 100) / 100}
      </Text>
      </View>
    </View>
  );
};

// Form scaffolding
export const FormControl: Renderer<FormControlProps> = ({ props, renderNode }) => {
  const t = useMd();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ marginLeft: 4, fontSize: 12, fontWeight: "500", color: t.onSurfaceVariant }}>
        {props.label}
      </Text>
      {renderNode(props.input)}
      {!!props.hint && (
        <Text style={{ marginLeft: 16, fontSize: 12, color: t.onSurfaceVariant }}>
          {props.hint}
        </Text>
      )}
    </View>
  );
};

// Buttons
/** M3 button mapping: primary→filled, secondary→tonal, tertiary→text. */
export const Button: Renderer<ButtonProps> = ({ props }) => {
  const t = useMd();
  const formName = useFormName();
  const triggerAction = useTriggerAction();
  const variant = props.variant ?? "primary";
  const destructive = props.type === "destructive";
  const bg =
    variant === "primary"
      ? destructive
        ? t.error
        : t.primary
      : variant === "secondary"
        ? destructive
          ? t.errorContainer
          : t.secondaryContainer
        : "transparent";
  const fg =
    variant === "primary"
      ? destructive
        ? t.onError
        : t.onPrimary
      : variant === "secondary"
        ? destructive
          ? t.onErrorContainer
          : t.onSecondaryContainer
        : destructive
          ? t.error
          : t.primary;
  const compact = props.size === "extra-small" || props.size === "small";
  return (
    <View style={{ borderRadius: 20, overflow: "hidden" }}>
      <Pressable
        onPress={() =>
          triggerAction(props.label ?? "", formName, props.action as ActionPlan | undefined)
        }
        android_ripple={{ color: variant === "primary" ? "rgba(255,255,255,0.2)" : t.ripple }}
        style={({ pressed }) => ({
          minHeight: compact ? 32 : 40,
          paddingVertical: compact ? 6 : 10,
          paddingHorizontal: compact ? 16 : 24,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text style={{ fontSize: 14, fontWeight: "500", color: fg }}>{props.label}</Text>
      </Pressable>
    </View>
  );
};

export const Buttons: Renderer<ButtonsProps> = ({ props, renderNode }) => {
  const column = props.direction === "column";
  return (
    <View style={{ flexDirection: column ? "column" : "row", gap: 10 }}>
      {(props.buttons ?? []).filter(Boolean).map((b, i) => (
        <View key={i} style={column ? undefined : { flex: 1 }}>
          {renderNode(b)}
        </View>
      ))}
    </View>
  );
};

export const Form: Renderer<FormProps> = ({ props, renderNode }) => (
  <FormNameContext.Provider value={props.name}>
    <View style={{ gap: 14 }}>
      {(props.fields ?? []).filter(Boolean).map((f, i) => (
        <React.Fragment key={i}>{renderNode(f)}</React.Fragment>
      ))}
      {renderNode(props.buttons)}
    </View>
  </FormNameContext.Provider>
);
