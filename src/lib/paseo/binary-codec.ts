import {
  TerminalStreamOpcode,
  encodeTerminalStreamFrame,
  decodeTerminalStreamFrame,
  encodeTerminalResizePayload,
  type TerminalStreamFrame,
} from "@getpaseo/protocol/binary-frames/index";

export const TerminalOpcode = TerminalStreamOpcode;
export type TerminalOpcode = TerminalStreamOpcode;
export type TerminalFrame = TerminalStreamFrame;

const textDecoder = new TextDecoder();

export function encodeTerminalFrame(
  opcode: TerminalStreamOpcode,
  slot: number,
  payload: Uint8Array | string | object,
): Uint8Array {
  let p: Uint8Array | string;
  if (typeof payload === "string" || payload instanceof Uint8Array) {
    p = payload;
  } else {
    p = JSON.stringify(payload);
  }
  return encodeTerminalStreamFrame({
    opcode,
    slot,
    payload: p,
  });
}

export function encodeTerminalInput(slot: number, data: string | Uint8Array): Uint8Array {
  return encodeTerminalStreamFrame({
    opcode: TerminalStreamOpcode.Input,
    slot,
    payload: data,
  });
}

export function encodeTerminalResize(slot: number, cols: number, rows: number): Uint8Array {
  return encodeTerminalStreamFrame({
    opcode: TerminalStreamOpcode.Resize,
    slot,
    payload: encodeTerminalResizePayload({ cols, rows, intent: "update" }),
  });
}

export function decodeTerminalFrame(buffer: ArrayBuffer | Uint8Array): TerminalStreamFrame | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return decodeTerminalStreamFrame(bytes);
}

export function decodeTerminalPayloadAsString(payload: Uint8Array): string {
  return textDecoder.decode(payload);
}

