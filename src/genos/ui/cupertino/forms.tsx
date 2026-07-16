/**
 * Cupertino form renderers. Field state flows through react-lang's form
 * context, so Buttons deliver formState on the ActionEvent. Schemas live in
 * ../contract.tsx. Validation rules are accepted but not enforced.
 */
import { FormNameContext, useFormName, useTriggerAction } from "@openuidev/react-lang";
import type { ActionPlan } from "@openuidev/react-lang";
import RNSlider from "@react-native-community/slider";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
import { useCds } from "./theme";

function useInputStyle() {
  const t = useCds();
  return {
    backgroundColor: t.group,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.sep,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: t.ink,
  } as const;
}

// Text inputs
export const Input: Renderer<InputProps> = ({ props }) => {
  const t = useCds();
  const field = useFieldState(props.name, "Input", props.value);
  const style = useInputStyle();
  return (
    <TextInput
      style={style}
      placeholder={props.placeholder}
      placeholderTextColor={t.ink3}
      {...textInputBehaviorProps(props.type)}
      value={typeof field.value === "string" ? field.value : ""}
      onChangeText={(text) => field.set(text, false)}
      onEndEditing={(e) => field.set(e.nativeEvent.text, true)}
    />
  );
};

export const TextArea: Renderer<TextAreaProps> = ({ props }) => {
  const t = useCds();
  const field = useFieldState(props.name, "TextArea", props.value);
  const style = useInputStyle();
  const rows = props.rows ?? 4;
  return (
    <TextInput
      style={[style, { minHeight: 24 + rows * 20, textAlignVertical: "top" }]}
      placeholder={props.placeholder}
      placeholderTextColor={t.ink3}
      multiline
      value={typeof field.value === "string" ? field.value : ""}
      onChangeText={(text) => field.set(text, false)}
      onEndEditing={(e) => field.set(e.nativeEvent.text, true)}
    />
  );
};

export const DatePicker: Renderer<DatePickerProps> = ({ props }) => {
  const t = useCds();
  const field = useFieldState(props.name, "DatePicker", props.value);
  const style = useInputStyle();
  return (
    <TextInput
      style={style}
      placeholder={props.mode === "range" ? "YYYY-MM-DD → YYYY-MM-DD" : "YYYY-MM-DD"}
      placeholderTextColor={t.ink3}
      value={typeof field.value === "string" ? field.value : ""}
      onChangeText={(text) => field.set(text, false)}
      onEndEditing={(e) => field.set(e.nativeEvent.text, true)}
    />
  );
};

// Select
/** Contract `size` → Cupertino paddings/font. */
const SELECT_SIZES = {
  small: { paddingVertical: 8, fontSize: 13 },
  medium: { paddingVertical: 12, fontSize: 15 },
  large: { paddingVertical: 15, fontSize: 17 },
} as const;

export const Select: Renderer<SelectProps> = ({ props }) => {
  const t = useCds();
  const field = useFieldState(props.name, "Select", props.value);
  const style = useInputStyle();
  const size = SELECT_SIZES[props.size ?? "medium"] ?? SELECT_SIZES.medium;
  const [open, setOpen] = useState(false);
  const items = readSelectItems(props.items);
  const selected = items.find((it) => it.value === field.value);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
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
        <Text style={{ fontSize: size.fontSize, color: selected ? t.ink : t.ink3 }}>
          {selected?.label ?? props.placeholder ?? "Select…"}
        </Text>
        <LucideIcon name="chevrons-up-down" size={14} color={t.ink3} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            padding: 32,
          }}
          onPress={() => setOpen(false)}
        >
          <View style={{ backgroundColor: t.group, borderRadius: 14, overflow: "hidden" }}>
            {items.map((it, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  field.set(it.value, true);
                  setOpen(false);
                }}
                style={({ pressed }) => ({
                  paddingVertical: 13,
                  paddingHorizontal: 16,
                  borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
                  borderTopColor: t.sep,
                  backgroundColor: pressed ? t.fill : "transparent",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                })}
              >
                <Text style={{ fontSize: 15, color: t.ink }}>{it.label ?? it.value}</Text>
                {it.value === field.value && (
                  <LucideIcon name="check" size={16} strokeWidth={2.4} color={t.tint} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

// Slider
export const Slider: Renderer<SliderProps> = ({ props }) => {
  const t = useCds();
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
      {!!props.label && <Text style={{ fontSize: 13, color: t.ink2 }}>{props.label}</Text>}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <RNSlider
        style={{ flex: 1, height: 32 }}
        minimumValue={props.min}
        maximumValue={props.max}
        step={props.variant === "discrete" ? (props.step ?? 1) : 0}
        value={current}
        minimumTrackTintColor={t.tint}
        maximumTrackTintColor={t.fill}
        onValueChange={(v) => field.set([v], false)}
        onSlidingComplete={(v) => field.set([v], true)}
      />
      <Text
        style={{
          minWidth: 36,
          textAlign: "right",
          fontSize: 13,
          fontWeight: "600",
          color: t.ink2,
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
  const t = useCds();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ marginLeft: 4, fontSize: 13, fontWeight: "600", color: t.ink2 }}>
        {props.label}
      </Text>
      {renderNode(props.input)}
      {!!props.hint && (
        <Text style={{ marginLeft: 4, fontSize: 12, color: t.ink3 }}>{props.hint}</Text>
      )}
    </View>
  );
};

// Buttons
export const Button: Renderer<ButtonProps> = ({ props }) => {
  const t = useCds();
  const formName = useFormName();
  const triggerAction = useTriggerAction();
  const variant = props.variant ?? "primary";
  const destructive = props.type === "destructive";
  const bg =
    variant === "primary"
      ? destructive
        ? t.red
        : t.tint
      : variant === "secondary"
        ? t.fill
        : "transparent";
  const fg = variant === "primary" ? "#fff" : destructive ? t.red : t.tint;
  const compact = props.size === "extra-small" || props.size === "small";
  return (
    <Pressable
      onPress={() =>
        triggerAction(props.label ?? "", formName, props.action as ActionPlan | undefined)
      }
      style={({ pressed }) => ({
        borderRadius: 14,
        paddingVertical: compact ? 9 : 13,
        paddingHorizontal: 18,
        backgroundColor: bg,
        alignItems: "center",
        opacity: pressed ? 0.75 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Text style={{ fontSize: compact ? 13.5 : 15, fontWeight: "600", color: fg }}>
        {props.label}
      </Text>
    </Pressable>
  );
};

export const Buttons: Renderer<ButtonsProps> = ({ props, renderNode }) => {
  const column = props.direction === "column";
  return (
    <View style={{ flexDirection: column ? "column" : "row", gap: 9 }}>
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
    <View style={{ gap: 12 }}>
      {(props.fields ?? []).filter(Boolean).map((f, i) => (
        <React.Fragment key={i}>{renderNode(f)}</React.Fragment>
      ))}
      {renderNode(props.buttons)}
    </View>
  </FormNameContext.Provider>
);
