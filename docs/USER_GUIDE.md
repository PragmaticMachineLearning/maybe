# Maybe User Guide

This guide explains how to use Maybe after the app is running. For installation
and development commands, start with the [README](../README.md).

## What Maybe Is

Maybe is a spreadsheet for uncertain models. You can enter ordinary values and
formulas, but you can also enter distributions directly into cells. When a
formula references uncertain cells, Maybe evaluates the formula over samples and
shows a sampled summary instead of collapsing everything to one number.

Use Maybe when you want to model questions like:

- What happens if this estimate is really a range?
- How does uncertainty in one input affect the output?
- Which inputs feed into this uncertain result?

## Spreadsheet Basics

Select a cell and type a value or formula.

- Plain text and numbers behave like normal spreadsheet cell values.
- Formulas start with `=`, such as `=A1*B1`.
- The formula bar shows the selected cell and lets you edit the current value.
- Press `Enter` to commit a cell edit.
- Press `Escape` while editing to cancel the edit.

The toolbar includes:

- `Examples`: loads a sample workbook and replaces the current sheet.
- graph button: switches between spreadsheet view and dependency graph view.
- `Docs`: opens the compact in-app reference.
- `Assistant`: opens the optional assistant panel.
- theme toggle: switches between visual themes.

## Entering Uncertain Values

Uncertain values use explicit distribution notation. Enter the notation directly
into a cell.

| Notation | Description |
| --- | --- |
| `N(mean, variance)` | Normal distribution using mean and variance. |
| `N.CI(lower, upper)` | Normal distribution inferred from a default 95% confidence interval. |
| `N.CI(lower, upper, confidence)` | Normal distribution inferred from a custom confidence interval. |
| `LN(mu, sigma)` | Lognormal distribution where `ln(X)` has mean `mu` and standard deviation `sigma`. |
| `LN.CI(lower, upper)` | Lognormal distribution inferred from a default 95% confidence interval on the original value scale. |
| `LN.CI(lower, upper, confidence)` | Lognormal distribution inferred from a custom confidence interval on the original value scale. |
| `U(min, max)` | Continuous uniform distribution between `min` and `max`. |

For user-facing estimates, `N.CI(...)`, `LN.CI(...)`, and `U(...)` are usually
easier to reason about than raw distribution parameters.

Use `U(min, max)` when the value is bounded and you do not want to imply a
most-likely point inside the range. Use `N.CI(lower, upper)` when the value is
an estimate with a likely center and uncertainty around it.

## First Walkthrough

Start with three cells:

| Cell | Input |
| --- | --- |
| `A1` | `N.CI(10, 20)` |
| `B1` | `U(2, 5)` |
| `C1` | `=A1*B1` |

What this means:

- `A1` is a normal distribution inferred from a 95% confidence interval between
  10 and 20.
- `B1` is a uniform distribution between 2 and 5.
- `C1` multiplies samples from `A1` and `B1`.

The result in `C1` is displayed as a sampled summary, for example a sampled
mean and standard deviation. The exact display is a summary of samples, not a
new formula you should type into another cell.

## Interpreting Sampled Results

When a formula combines uncertain values, Maybe samples the inputs and evaluates
the formula across those samples.

Sampled results are displayed as summaries such as:

```text
sampled mean=<value> standard deviation=<value>
```

The summary is approximate because it comes from samples. For the same workbook
and sampling configuration, results are deterministic.

Do not type sampled summary text back into a cell. Use the original formula or
distribution notation instead.

## Distribution Charts

Uncertain cells can be visualized as charts. Use charts to inspect the shape of
a distribution or sampled result.

Charts are most useful for:

- comparing a simple range with the resulting output
- checking whether a lognormal value is strongly skewed
- explaining why a sampled output has a wide spread

If a cell contains a scalar value or plain text, there is no distribution to
plot.

## Dependency Graph

The dependency graph shows how cells feed into each other.

Use the graph view when you want to answer:

- Which inputs affect this output?
- Which outputs depend on this input?
- Where did this sampled result come from?

The graph includes formulas and uncertain values, so it can be easier to reason
about a model than scanning cell references manually.

## Built-In Functions

Most built-in spreadsheet functions work with uncertain values by applying the
operation over samples.

If a formula combines uncertain and scalar values, Maybe broadcasts scalar
values across the sample set. For example, if `A1` is uncertain, `=A1*2`
multiplies each sample from `A1` by `2`.

## Assistant

The Assistant panel can inspect the workbook, explain formulas, validate
suggested formulas, and prepare workbook changes.

The Assistant requires the server environment to provide `OPENAI_API_KEY`.
Without that key, the app still runs, but assistant requests return a setup
error.

When using the Assistant:

- Treat suggestions as proposed model edits.
- Review formulas before applying them.
- Prefer specific prompts such as "Explain why C1 has a wide spread" or
  "Suggest a formula for D1 that calculates expected revenue from A1 and B1."

For setup, production commands, and contribution checks, see the
[README](../README.md).
