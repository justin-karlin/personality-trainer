# Research behind Trait Trainer

This is a literature review of evidence-based methods for deliberately changing Big Five personality traits, and how each finding shaped the app. It was compiled in September 2026. Full citations with links are in [`src/data/references.ts`](../src/data/references.ts) and on the app's **Science** page.

**How claims were checked.** Every study was checked against abstracts and journal records found by web search. Full texts and some publisher sites could not be accessed from the research environment. Where a paper's exact title could not be confirmed, the app shows a descriptive title in [square brackets]. Items marked *preprint* have not been peer reviewed.

---

## 1. Can personality be changed on purpose?

**Yes, modestly, if the goal is turned into repeated behaviour.**

| Finding | Evidence |
|---|---|
| Traits change through intervention. Across 207 studies (mostly therapy), d ≈ 0.37 over ~24 weeks. **Emotional stability changed most**, then extraversion. Changes persisted at follow-up. | Roberts et al. 2017, *Psych Bull* |
| In two 16-week experiments, people who wanted to change a trait tended to change toward their goal. Coaching them to write **if-then plans** helped. | Hudson & Fraley 2015, *JPSP* |
| **Only completed challenges predicted growth.** Accepting more challenges while completing the same number predicted change in the *opposite* direction. | Hudson et al. 2019, *JPSP* |
| Pooling 12 studies (N = 2,238), change goals predicted growth in all five traits: about 0.16 SD for extraversion and emotional stability, about 0.05 SD for agreeableness and openness, over 16 weeks. | Hudson et al. 2020, *SPPS* |
| **PEACH trial** (N = 1,523, 3-month smartphone chatbot coaching vs. waitlist): self-reported change d = 0.52 for increases and −0.58 for decreases. Observers saw d = 0.35 for increases; they did not detect decreases. Changes held at 3 months. | Stieger et al. 2021, *PNAS* |
| At 1 year, PEACH gains held for extraversion and conscientiousness, and neuroticism kept falling. But only 157 of the 1,523 participants responded, and they were the better-adjusted ones. | Stieger et al. 2024, *J Pers* |
| A 2-week app focused on a single facet (self-discipline or openness to action) changed that facet, by self- and observer report. | Stieger et al. 2020, *EJP* |
| Systematic review of 30 studies: the average intervention effect was **d = 0.22**. Goals alone were only weakly related to change. | Haehner et al. 2024, *Comms Psych* |
| When people are left to change on their own, **wanting to change does not predict change**. | Baranski et al. 2020, *JRP*; Lücke et al. 2021 |
| Commitment, the number of if-then plans carried out, and **enjoyment** predicted change. How strongly people wanted to change, and their belief in change, did not. | Olaru et al. 2025, *EJP* |
| Weeks with more behavioural practice and more use of personal strengths went with more goal-consistent personality states. | Allemand et al. 2024, *EJP* |
| For emotional stability, activities only worked when people **chose** that goal themselves. Conscientiousness activities worked even when assigned. | Hudson 2021, *JRP* |
| Agreeableness activities also reduced dark-triad traits. | Hudson 2023, *J Pers* |
| TESSERA: trait change builds up from many repeated everyday sequences of situation, expectation, state and reaction. | Wrzus & Roberts 2017, *PSPR* |
| **Caution:** in one study, a waitlist control changed as much as the intervention groups. Expectations and demand effects can inflate self-reports. | Krämer et al. 2025, *JPSP* |
| **Caution:** perceived and measured change agreed only moderately (r ≈ .49), and about 39% of responses perceived change in the wrong direction. | Hudson, Derringer & Briley 2019, *JRP* |
| *Preprint.* A 6-week app lowered neuroticism (d ≈ −0.2 to −0.4). Behavioural **habits** outlasted in-the-moment strategies. | Haehner et al., CHILL (PsyArXiv m8a5r) |

### Design principles that follow

| Principle | Strength | How the app implements it |
|---|---|---|
| Provide structure. Motivation alone is not enough. | Strong | Goals become weekly behavioural challenges |
| If-then plans | Strong | Required for every challenge |
| Completion over commitment; avoid overcommitting | Moderate | Start easy; confidence check below 7/10; adaptive difficulty and count |
| Self-monitoring | Strong | Daily check-offs, daily state rating, charts |
| Repeated trait-consistent behaviour becomes habit | Moderate | Completed challenges are suggested again; the 12-week horizon |
| Reflection, strengths, enjoyment | Emerging | Weekly reflection that starts from strengths; enjoyment ratings steer suggestions |
| Self-chosen goals | Emerging | The user picks their own goals |
| Honest expectations | Strong (methodological) | Science page caveats; re-measurement rather than "do you feel different?" |

---

## 2. Techniques by trait

Ratings:
- **Strong:** consistent benefits across multiple RCTs or meta-analyses.
- **Moderate:** RCT support, but effects are small, mixed, or mostly measured against weak controls.
- **Emerging:** early, lab-based, or correlational evidence.

The **outcome** column matters. Most techniques were tested on outcomes close to a trait, not on the trait score itself.

### Emotional stability (reducing neuroticism)
Neuroticism has the strongest evidence of the five traits that it can be changed. Therapist-led Unified Protocol CBT reduced neuroticism itself (d = −0.43 vs waitlist; Sauer-Zavala et al. 2021). A later trial, however, found a smaller effect.

| Technique | Rating | Outcome | Key evidence |
|---|---|---|---|
| Behavioural activation | Strong | Depression | Ekers et al. 2014 (26 RCTs, SMD −0.74); Furukawa et al. 2021 (a helpful ingredient in iCBT) |
| Physical activity | Strong | Depression, anxiety, distress | Singh et al. 2023 (1,039 trials; about −0.4 to −0.6) |
| Mindfulness | Strong | Anxiety and depression (small); neuroticism | Goyal et al. 2014; Linardon et al. 2024 (apps, g ≈ 0.25); Almenräder et al. 2025 |
| Graded exposure / approach | Strong (in CBT) | Anxiety | Carpenter et al. 2018 (g = 0.56 vs placebo) |
| Self-compassion | Moderate | Rumination, stress, depression, anxiety | Ferrari et al. 2019 (27 RCTs, mostly vs waitlist) |
| Cognitive reappraisal | Moderate | Momentary emotion | Webb et al. 2012. Added little alone in iCBT (Furukawa 2021) |
| Worry postponement | Moderate | Worry (small) | McGowan & Behar 2013; Dippel et al. 2023 (7 RCTs) |
| Problem-solving | Moderate | Depression | Cuijpers et al. 2018 |
| Expressive writing | Moderate | Various (small, r ≈ .08) | Frattaroli 2006 (146 RCTs) |
| Affect labelling | Emerging | Lab emotion response | Lieberman et al. 2007 |

### Conscientiousness

| Technique | Rating | Outcome | Key evidence |
|---|---|---|---|
| If-then plans | Strong | Goal attainment (d = 0.65) | Gollwitzer & Sheeran 2006 |
| WOOP / MCII | Strong | Goal attainment (g = 0.34) | Wang et al. 2021 |
| Self-monitoring | Strong | Goal attainment (d = 0.40) | Harkin et al. 2016 |
| Habit formation | Moderate | Automaticity (median ~66 days; a missed day doesn't matter) | Lally et al. 2010; Gardner et al. 2012 |
| Situation / environment design | Moderate | Goal attainment | Duckworth et al. 2016 |
| Temptation bundling | Moderate | Exercise | Milkman et al. 2014; Kirgios et al. 2020 |
| "Just start" (procrastination CBT) | Moderate | Procrastination | Rozental et al. 2015 |
| Commitment devices | Moderate (low uptake) | Behaviour change | Giné et al. 2010 |

Do **not** cite Ariely & Wertenbroch (2002) on self-imposed deadlines. It was retracted in September 2026.

### Extraversion

| Technique | Rating | Outcome | Key evidence |
|---|---|---|---|
| Acting extraverted | Moderate | Positive affect, connection, well-being | Fleeson et al. 2002; Jacques-Hamilton et al. 2019; Margolis & Lyubomirsky 2020; van Allen et al. 2021 |
| Talking to strangers / weak ties | Moderate | Affect; fear of rejection; conversational confidence | Epley & Schroeder 2014; Sandstrom & Dunn 2014; Sandstrom et al. 2022 |

**Costs:** introverts gained less and felt more tired in one RCT (Jacques-Hamilton 2019). Others found few costs (Margolis 2020; van Allen 2021). Extraverted behaviour predicts fatigue about 3 hours later (Leikas & Ilmarinen 2017). So the app advises recharge time after bigger social challenges.

### Agreeableness
No verified study shows change in *trait* agreeableness from these techniques alone. Challenge-based agreeableness programs did reduce dark traits (Hudson 2023).

| Technique | Rating | Outcome | Key evidence |
|---|---|---|---|
| Loving-kindness / compassion meditation | Strong | Compassion, positive emotion; prosocial behaviour (small–moderate) | Galante et al. 2014; Kirby et al. 2017; Luberto et al. 2018 |
| Acts of kindness / prosocial spending | Moderate | Giver's well-being (δ = 0.28) | Curry et al. 2018; Dunn et al. 2008 |
| Gratitude expression | Moderate | Well-being (small) | Davis et al. 2016; Seligman et al. 2005 |
| Forgiveness (REACH) | Moderate | Forgiveness, depression, anxiety | Wade et al. 2014 |
| Perspective-taking | Emerging | Anger and negative emotion | Webb et al. 2012 |
| Responsive listening / active-constructive responding | Emerging | Relationship quality (correlational) | Gable et al. 2004 |

### Openness
This trait has the thinnest evidence. The app labels every openness technique *emerging*.

| Technique | Rating | Outcome | Key evidence |
|---|---|---|---|
| Novelty / openness-to-action practice | Emerging | Openness facet | Stieger et al. 2020 |
| Reasoning training + puzzles | Emerging | Openness (older adults, 1 RCT) | Jackson et al. 2012 |
| Awe walks | Emerging | Awe, prosocial emotion | Sturm et al. 2020 |
| Literary fiction | Emerging | Self-reported trait change (either direction) | Djikic et al. 2009 |

---

## 3. Measurement

**IPIP 50-item Big-Five Factor Markers** (Goldberg 1992):
- Public domain.
- Items and keying were cross-checked against an archived copy of the ipip.ori.org page, the Open-Source Psychometrics codebook, and two scoring scripts.
- The fourth factor is keyed as Neuroticism in the app, the reverse of IPIP's Emotional Stability.

**Norms.** ipip.ori.org recommends local norms and publishes none. The app's rough percentiles are mid-rank percentiles from the Open-Source Psychometrics "BIG5" dataset: N = 19,718 web respondents who answered the same 50 items on Disagree–Agree anchors.

| Trait | Mean per item | SD |
|---|---|---|
| Conscientiousness | 3.35 | 0.73 |
| Agreeableness | 3.85 | 0.72 |
| Extraversion | 3.01 | 0.92 |
| Openness | 3.91 | 0.63 |
| Neuroticism | 3.10 | 0.86 |

Internal consistency in that dataset was α ≈ .79–.89.

**Well-being screen.** The optional PHQ-4 (Kroenke et al. 2009) consists of the GAD-2 plus the PHQ-2. A score of 3 or more on either subscale triggers a recommendation to seek a professional evaluation.

**Known measurement caveat.** Several items describe behaviours the challenges practise ("Start conversations", "Take time out for others"). Doing challenges can raise scores partly by changing how people answer. Observer ratings are the recommended next feature.

---

## 4. Safety

- Self-guided digital CBT helps mild symptoms. Guided or professional care works better for moderate or severe symptoms (Karyotaki et al. 2021). In trials, users of self-guided iCBT were less likely to deteriorate than controls (5.8% vs 9.1%; Karyotaki et al. 2018, *Psychol Med*).
- The app is always non-diagnostic and shows crisis resources in the footer and Settings: 988 call or text in the US, Crisis Text Line (text HOME to 741741), and findahelpline.com internationally.
- Support prompts appear after a positive PHQ-4 screen (for 14 days) and after 2–3 days of mood ratings at or below 2 out of 7.
- Increasing neuroticism is not offered as a goal (as in PEACH).

---

## 5. Open questions worth tracking

- **Active controls.** Do these programs beat an equally engaging placebo? See Krämer et al. 2025, and "Ten concerns about volitional personality-change interventions" (Haehner et al. 2026, *Perspectives on Psychological Science*).
- **Long-term durability** beyond one year, and change in samples other than students.
- **Diverse samples.** Most studies used students or motivated volunteers from Western countries.
- **Informant and behavioural outcomes**, not just self-report (Asselmann et al. 2026, *SPPC*).
- **Ethics** of personality optimisation: pressure to conform, and whether some trait levels come to be seen as "better".
