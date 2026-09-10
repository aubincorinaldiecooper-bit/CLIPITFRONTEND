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
      isCollapsible
      isDisabled={isDisabled}
      attach={
        withAttachment
          ? { label: "Add a video", accept: "video/*", onPick: vi.fn() }
          : undefined
      }
    />
  );
}

describe("the folding ask composer", () => {
  it("starts as a compact prompt and opens into the full editor", async () => {
    const person = userEvent.setup();
    render(<Composer />);

    expect(
      screen.queryByRole("textbox", { name: "Search your footage" }),
    ).toBeNull();
    const opener = screen.getByRole("button", {
      name: "Open search your footage",
    });
    expect(opener.textContent).toBe("Ask anything");

    await person.click(opener);

    expect(
      screen.getByRole("textbox", { name: "Search your footage" }),
    ).toBeTruthy();
  });

  it("folds again after an empty editor loses focus", async () => {
    const person = userEvent.setup();
    render(
      <>
        <Composer />
        <button type="button">Outside</button>
      </>,
    );

    await person.click(
      screen.getByRole("button", { name: "Open search your footage" }),
    );
    await person.click(screen.getByRole("button", { name: "Outside" }));

    expect(
      screen.getByRole("button", { name: "Open search your footage" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("textbox", { name: "Search your footage" }),
    ).toBeNull();
  });

  it("keeps a written question open when focus leaves", async () => {
    const person = userEvent.setup();
    render(
      <>
        <Composer />
        <button type="button">Outside</button>
      </>,
    );

    await person.click(
      screen.getByRole("button", { name: "Open search your footage" }),
    );
    await person.type(
      screen.getByRole("textbox", { name: "Search your footage" }),
      "Find the goal",
    );
    await person.click(screen.getByRole("button", { name: "Outside" }));

    expect(
      screen.getByRole("textbox", { name: "Search your footage" }),
    ).toBeTruthy();
  });

  it("still opens to the upload action when typing is unavailable", async () => {
    const person = userEvent.setup();
    render(<Composer isDisabled withAttachment />);

    await person.click(
      screen.getByRole("button", { name: "Open search your footage" }),
    );

    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Add a video" })
        .disabled,
    ).toBe(false);
    expect(
      screen
        .getByRole("textbox", { name: "Search your footage" })
        .getAttribute("contenteditable"),
    ).toBe("false");
  });
});
