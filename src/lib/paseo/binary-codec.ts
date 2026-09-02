import { TerminalOpcode, type TerminalFrame } from "./types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodeTerminalFrame(
  opcode: TerminalOpcode,
  slot: number,
  payload: Uint8Array | string | object,
): Uint8Array {
  let payloadBytes: Uint8Array;
  if (typeof payload === "string") {
    payloadBytes = textEncoder.encode(payload);
  } else if (payload instanceof Uint8Array) {
    payloadBytes = payload;
  } else {
    payloadBytes = textEncoder.encode(JSON.stringify(payload));
  }

  const frame = new Uint8Array(2 + payloadBytes.byteLength);
  frame[0] = opcode;
  frame[1] = slot & 0xff;
  frame.set(payloadBytes, 2);
  return frame;
}

export function encodeTerminalInput(slot: number, data: string | Uint8Array): Uint8Array {
  return encodeTerminalFrame(TerminalOpcode.Input, slot, data);
}

export function encodeTerminalResize(slot: number, cols: number, rows: number): Uint8Array {
  return encodeTerminalFrame(
    TerminalOpcode.Resize,
    slot,
    JSON.stringify({ cols, rows, intent: "update" }),
  );
}

export function decodeTerminalFrame(buffer: ArrayBuffer | Uint8Array): TerminalFrame | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 2) {
    return null;
  }

  const opcode = bytes[0] as TerminalOpcode;
  const slot = bytes[1] ?? 0;
  const payload = bytes.subarray(2);

  return {
    opcode,
    slot,
    payload,
  };
}

export function decodeTerminalPayloadAsString(payload: Uint8Array): string {
  return textDecoder.decode(payload);
}
