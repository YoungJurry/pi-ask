# pi-ask

An interactive question tool for the [Pi coding agent](https://github.com/earendil-works/pi-mono), with single- and multi-question flows, multi-select options, and custom freeform answers.

## Features

- Ask one or multiple questions in a tabbed TUI
- Select multiple options with `Space`
- Add a custom freeform answer alongside selected options
- Review all answers before submitting
- Optional question IDs and option values for simpler, more reliable tool calls
- Theme-aware rendering with progress and answer summaries

## Install

Copy `ask.ts` into Pi's global extension directory:

```bash
mkdir -p ~/.pi/agent/extensions
curl -fsSL https://raw.githubusercontent.com/smithyyang/pi-ask/main/ask.ts \
  -o ~/.pi/agent/extensions/ask.ts
```

Then run `/reload` inside Pi.

## Tool input

Only `prompt`, `options`, and each option's `label` are required:

```json
{
  "questions": [
    {
      "prompt": "Which approach should we use?",
      "options": [
        {
          "label": "Keep the current implementation"
        },
        {
          "label": "Refactor it",
          "description": "Simplify the schema and retain compatibility"
        }
      ]
    }
  ]
}
```

Optional fields:

- Question `id`: generated as `q1`, `q2`, etc. when omitted
- Question `label`: short tab label, generated as `Q1`, `Q2`, etc. when omitted
- Option `value`: defaults to the option label when omitted
- Option `description`: secondary text shown below the label

## Controls

- `↑` / `↓`: move
- `Space`: toggle an option or open custom input
- `Enter`: confirm and advance
- `Tab` / `←` / `→`: switch pages in multi-question mode
- `Esc`: cancel
