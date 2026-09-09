# Model marks

The composer's model picker looks for these five files. Each is optional: a
mark that is missing is drawn as a plain square instead, so the row never
shows a broken image.

    gpt.svg        GPT 5.5
    opus.svg       Opus 4.8
    gemini.svg     Gemini 3.5 Flash
    composer.svg   Composer 2.5
    glm.svg        GLM 5.2

Square-ish SVGs, drawn edge to edge; they render at 14px. Three of them are
inverted for the dark ground — see `MODELS` in
`components/start/composer-controls.tsx` if a mark comes out the wrong way
round.
