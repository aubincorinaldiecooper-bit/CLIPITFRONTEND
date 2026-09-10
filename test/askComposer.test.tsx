import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { AskComposer } from "../components/start/ask-composer";

afterEach(cleanup);

function Composer({ isDisabled = false, withAttachment = false }) {
  const [value, setValue] = useState("");
  return (
    <AskComposer
      value={value}
      onChange={setValue}
      onSubmit={vi.fn()}
      placeholder="Ask anything"
      label="Search your footage"
      isDisabled={isDisabled}
      attach={
        withAttachment
          ? { label: "Add a video", accept: "video/*", onPick: vi.fn() }
          : undefined
      }
    />
  );
}

/**
 * The box is always open — the owner's call of 2026-09-10, with a picture of
 * what they want: the question on its own line, and the model, the effort
 * dial, the plus and the action button in a row beneath it.
 *
 * This file used to describe a fold: an empty box shrank to a one-line pill
 * and opened on focus. Those tests went with the fold rather than being
 * fixed, because the behaviour they described is not wanted. The one claim
 * worth carrying forward is the last of them — that a box which cannot be
 * typed into can still take a video — and it is here.
 *
 * Worth remembering: the fold's four tests all passed while the box could
 * not be typed into at all in a real browser. Opening it swapped the pill
 * for the editor, and the focus handlers read the pill's own removal as
 * "focus left the box", so it shut in the same frame the click opened it.
 * jsdom does not move focus the way a browser does, so nothing here saw it.
 */
describe("the ask composer", () => {
  it("is open, with nothing to press first", () => {
    render(<Composer />);
    const box = screen.getByRole("textbox", { name: "Search your footage" });
    expect(box.getAttribute("contenteditable")).toBe("true");
    // No pill in front of it, and nothing claiming to be closed.
    expect(screen.queryByRole("button", { name: /^Open / })).toBeNull();
    expect(document.querySelector("[aria-expanded]")).toBeNull();
  });

  it("takes typing straight away", async () => {
    const person = userEvent.setup();
    render(<Composer />);
    await person.type(
      screen.getByRole("textbox", { name: "Search your footage" }),
      "find the harbour",
    );
    expect(screen.getByRole("textbox", { name: "Search your footage" }).textContent).toBe(
      "find the harbour",
    );
  });

  it("still takes a video when it will not take typing", async () => {
    render(<Composer isDisabled withAttachment />);
    // The editor is shut, because there is nothing to ask about yet.
    expect(
      screen
        .getByRole("textbox", { name: "Search your footage" })
        .getAttribute("contenteditable"),
    ).toBe("false");
    // The plus is not, because adding a video is how that changes.
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Add a video" }).disabled,
    ).toBe(false);
  });
});
