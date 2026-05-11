---
name: source-triangulation
description: Strengthen research quality by requiring cross-source validation, source diversity, and explicit handling of disagreements before forming conclusions.
---

# Source Triangulation

Use this skill to improve research reliability through cross-source validation.

## When To Use

Use this skill when:

- the topic requires confident factual claims
- conclusions may influence technical, product, or strategy decisions
- a claim looks strong but currently depends on one source family
- the topic is likely to contain conflicting narratives

Examples:

- architecture evaluations
- competitive comparisons
- trend analysis
- product capability claims
- implementation guidance

## Core Principle

Do not treat one source as enough for an important conclusion unless it is a direct primary source and the claim is strictly limited to what that source can prove.

## Validation Rules

For major claims, try to combine multiple source types such as:

- official documentation
- source code or repository metadata
- vendor or maintainer statements
- technical blogs or implementation writeups
- credible media or analyst reporting
- community discussion for practical issues and sentiment

## Workflow

1. Classify each useful source: official, repo, technical analysis, media, or community discussion.
2. Check whether the same claim appears across more than one source family.
3. Prefer direct evidence over interpretation.
4. When sources disagree, preserve the disagreement instead of flattening it.
5. Lower confidence for claims supported only by weak or repetitive sources.

## Confidence Guidance

- High confidence: primary source plus at least one corroborating independent source, or multiple direct sources
- Medium confidence: one reliable source with partial corroboration
- Low confidence: weak, indirect, outdated, or single-source support

## Output Expectations

When this skill is active:

- explicitly note when a conclusion is single-source
- surface contradictions and uncertainty
- separate verified facts from interpretation
- avoid overstating consensus

## Anti-Patterns

Avoid these mistakes:

- treating many pages that repeat the same claim as independent evidence
- mixing opinion and fact without labels
- using social posts as primary proof for technical facts
- assigning high confidence to unsupported synthesis
