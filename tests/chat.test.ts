import { describe, expect, it } from "vitest";
import { chatParts, chatPlain, chatRefs, keepRefs, mentionToken, pendingRef, taskToken, withRefs } from "../lib/chat";

describe("chat messages", () => {
  const binh = { id: "u1", name: "Trần Thị Bình" };
  const an = { id: "u2", name: "An" };
  const anNhien = { id: "u3", name: "An Nhiên" };
  const task = { id: "t1", title: "Báo giá khách A" };

  it("turns picked @people and #tasks into tokens, longest name first, only at a word start", () => {
    const out = withRefs("@Trần Thị Bình, @An Nhiên và @An làm #Báo giá khách A. email@An", { users: [binh, an, anNhien], tasks: [task] });
    expect(out).toBe(`${mentionToken(binh)}, ${mentionToken(anNhien)} và ${mentionToken(an)} làm ${taskToken(task)}. email@An`);
    expect(withRefs("@Anh", { users: [an], tasks: [] })).toBe("@Anh"); // not "@An" + "h"
  });

  it("reads tokens back as parts, plain text and references", () => {
    const content = `${mentionToken(binh)} xem ${taskToken(task)} nhé ${mentionToken(binh)}`;
    expect(chatParts(content).map((p) => p.kind)).toEqual(["mention", "text", "task", "text", "mention"]);
    expect(chatPlain(content)).toBe("@Trần Thị Bình xem #Báo giá khách A nhé @Trần Thị Bình");
    expect(chatRefs(content)).toEqual({ users: ["u1"], tasks: ["t1"] });
    // A mismatched sign is text, not a reference.
    expect(chatRefs("@[Bình](t:t1) #[X](u:u1)")).toEqual({ users: [], tasks: [] });
  });

  it("keeps only the references that may stay, the rest becomes text", () => {
    const content = `${mentionToken(binh)} ${mentionToken(an)} ${taskToken(task)}`;
    expect(keepRefs(content, new Map([["u1", "Trần Thị Bình"]]), new Map())).toBe(`${mentionToken(binh)} @An #Báo giá khách A`);
    // A label that is not the person's name gives way to the real one.
    expect(keepRefs(`${mentionToken({ id: "u1", name: "Giám đốc" })} ${taskToken({ id: "t1", title: "Việc khác" })}`, new Map([["u1", "Trần Thị Bình"]]), new Map([["t1", task.title]]))).toBe(
      `${mentionToken(binh)} ${taskToken(task)}`,
    );
    // Brackets in a name cannot break the token.
    expect(chatParts(mentionToken({ id: "u9", name: "Lan [HR]" }))).toEqual([{ kind: "mention", id: "u9", name: "Lan  HR" }]);
  });

  it("finds the @ or # being typed before the caret", () => {
    expect(pendingRef("Chào @bi")).toEqual({ sign: "@", query: "bi", start: 5 });
    expect(pendingRef("#")).toEqual({ sign: "#", query: "", start: 0 });
    expect(pendingRef("email@bi")).toBeNull();
    expect(pendingRef("@bi xong")).toBeNull();
  });
});
