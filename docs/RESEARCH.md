# Research behind Trait Trainer

This is a literature review of evidence-based methods for deliberately changing Big Five personality traits, and how each finding shaped the app. It was compiled in September 2026, and its key claims were re-checked against full texts in October 2026. Full citations with links are in [`src/data/references.ts`](../src/data/references.ts) and on the app's **Science** page.

**How claims were checked.** The review was first compiled from abstracts and journal records found by web search. In October 2026, every claim citing the following 24 papers, plus the CHILL study protocol (Haehner et al. 2025), was re-checked against the full text, along with Almenräder et al. 2024: Hudson & Fraley 2015; Hudson et al. 2019 (*JPSP*) and 2020; Hudson 2021 and 2023; Stieger et al. 2020, 2021 and 2024; Olaru et al. 2024 and 2026; Allemand et al. 2024; Roberts et al. 2017; Haehner et al. 2024 and 2026; Asselmann et al. 2026; Krämer et al. 2025; Baranski et al. 2020; Wright et al. 2026; Sauer-Zavala et al. 2021; Lorenzo-Luaces 2023; Dippel et al. 2024; Jacques-Hamilton et al. 2019; Jackson et al. 2012; Wade et al. 2014.
- Most were checked against the journal version. Rows marked † were checked against an author manuscript or preprint instead: Stieger et al. 2020, 2021 and 2024 and Krämer et al. 2025 (author manuscripts of the published papers), Wright et al. 2026 (accepted manuscript), the Haehner et al. 2026 "ten concerns" paper (October 2025 preprint; the journal version was not read) and the CHILL protocol (December 2024 preprint draft).
- Almenräder et al. 2024 (mindfulness and neuroticism) was checked against its online-first journal version (European Journal of Personality, 2024, Vol. 0(0), 1–23).
- All other papers in this review (e.g. Gollwitzer & Sheeran 2006, Lally et al. 2010, Harkin et al. 2016) were checked against abstracts and journal records only.
- Where a paper's exact title could not be confirmed, the app shows a descriptive title in [square brackets].

---

## 1. Can personality be changed on purpose?

**Yes, modestly, and mostly by self-report.** Wanting to change predicts little on its own. Structured programs that turn goals into repeated behaviour show larger but still small changes, and few trials use strong controls.

| Finding | Evidence |
|---|---|
| Trait scores shift during intervention. A meta-analysis of 207 studies, mostly psychotherapy or medication for depression, anxiety and similar problems; trait change was rarely the goal. Mostly self-reported trait scores improved by d ≈ 0.37 pre–post (≈ 0.2–0.3 after bias corrections). In the 35 experiments, treated groups beat controls by d ≈ 0.43, but one bias correction shrank this to ≈ 0.13. The median program lasted 13 weeks (the mean of 24 is skewed by a few long studies). Between studies, programs under about 4 weeks had small effects, and those beyond about 8 weeks showed no more change. **Emotional stability changed most** (d ≈ 0.57), then extraversion (0.23); it was the only trait whose experimental effect survived bias correction. In clinical samples, changes held at follow-ups, including beyond a year. The authors call the support for true trait change "tentative". | Roberts et al. 2017, *Psych Bull* |
| Two 16-week studies of students in an upper-level personality psychology course (N = 135 and 151; all self-report). Wanting to change a trait predicted modest change toward the goal: people 1 SD above average in desire changed about 0.17 SD more than their peers over the semester (averaged across traits and both studies; correlational; goals were measured, not assigned). In Study 2, randomly assigned weekly coaching to write concrete small steps and **if-then plans** sped desired change in extraversion, conscientiousness and emotional stability, but not agreeableness or openness. For people wanting more extraversion, the predicted gain was about 0.45 SD with coaching vs 0.21 SD without. Study 1's vaguer "list 3 ways" plan did not help and may have backfired. The authors noted that the Study 2 coaching effect had not yet been replicated. | Hudson & Fraley 2015, *JPSP* |
| One 15-week study of 377 students (self-report; correlational; everyone got the challenges, so there was no control group). Completing more challenges predicted growth in extraversion, conscientiousness and emotional stability: about +0.04 SD a month per SD more completions, or about +0.17 SD over the semester for two extraversion challenges a week. It did not predict growth in agreeableness or openness (the openness estimate was slightly negative). Accepting challenges on its own did not predict growth. Among people who completed the same number, those who accepted more grew slightly less than their peers (−0.02 to −0.05 SD a month per SD) in every trait except openness. Harder challenges did not reliably produce more growth (mixed by trait, about zero on average). | Hudson et al. 2019, *JPSP* |
| The authors pooled all 12 of their own semester-long samples of US college students (N = 2,238). Students whose goal to increase a trait was 1 SD stronger than average grew more in it over 16 weeks than peers with average goals. The extra growth was about 0.14 SD for extraversion, 0.18 for emotional stability, 0.09 for conscientiousness, 0.05 for agreeableness and 0.04 for openness (the openness effect was not robust in one model). Correlational and self-report. In exploratory analyses, goals predicted growth best early in the semester, and less later, for extraversion, conscientiousness and emotional stability. | Hudson et al. 2020, *SPPS* |
| When people are left to change on their own, wanting to change predicts at most small change. Pooled semester-long student samples (a few of which included an intervention) show small effects (Hudson et al. 2020, above). In studies lasting 6 months to 2 years, goals mostly predicted no change toward the goal. Baranski et al. followed online US adults for 1 year and US students for 6 months (about 60% dropped out). In students, wanting more extraversion, agreeableness or conscientiousness went with *declines* in that trait, and wanting more extraversion with small rises in agreeableness and emotional stability. These effects (p = .01 to .05, among many uncorrected tests) appeared only in students, and the authors warn they may be chance. Lücke et al. 2021 (N = 382, 2 years) found no effect in any trait. | Baranski et al. 2020, *JRP*; Lücke et al. 2021, as summarized by Haehner et al. 2024 |
| **PEACH trial** (1,523 consented and completed a pretest; 875 started; mostly young, non-clinical, German-speaking adults, each with one self-chosen trait goal; 10 weeks of smartphone chatbot coaching within about 3 months). In the randomized comparison, from pretest to posttest the intervention group's self-reported traits changed d = 0.44 toward increase goals and −0.41 toward decrease goals. That was significantly more than the waitlist group changed during its 1-month wait (−0.12 and −0.02). Waitlisters then got the same program, so later results have no control group. Among starters, self-reported change from pretest to the follow-up 3 months after the program ended was d = 0.52 for increases and −0.58 for decreases. Friends, family or partners rated increases (d = 0.35, mainly conscientiousness) but not decreases (−0.22, not significant). Lowering conscientiousness, extraversion or openness, and raising openness, showed no significant self-reported change. | Stieger et al. 2021, *PNAS* † |
| Exploratory facet-level re-analysis of PEACH: 552 people who completed the post-test. Each of the three largest goal groups (n = 168, 140 and 110) was compared with people working on other traits; there was no randomized comparison in this analysis. Self-reported change was uneven within traits. Sociability, productiveness, organization and anxiety moved most, while assertiveness, energy level and responsibility did not change significantly. All three neuroticism facets fell, anxiety most. Observers reported no significant facet change except a rise in assertiveness in the extraversion group at follow-up. | Olaru et al. 2024, *EJP* |
| At 1 year (self-report only; no observer ratings and no untreated control at that point), PEACH gains held, without growing further, for people who wanted more extraversion or conscientiousness. Neuroticism kept falling for those who wanted less. Only 157 of the 1,523 participants (10%) gave 1-year data, 32–57 per goal group. Among posttest completers, the 1-year responders had been slightly more conscientious, agreeable, open and emotionally stable at posttest than those who skipped the 1-year survey (d = 0.19–0.35), with no difference in extraversion, age or gender. | Stieger et al. 2024, *J Pers* † |
| A 2-week text-message program (two SMS a day; N = 255 across two studies, mostly Swiss university students) targeted one facet, self-discipline or openness to action. People chose their own group, with no randomization or untreated control. Each group rose more on its chosen facet than the other group (self-report), and the gains held at 2- and 6-week follow-ups. In Study 2, close others also rated increases within each group (small for self-discipline, d = 0.31). The self-discipline group also rose in broad conscientiousness by self-report; broad openness did not change. | Stieger et al. 2020, *EJP* † |
| Systematic review of 30 studies (N = 7,719; mostly young; 62% of samples were college students). Pooling 7 intervention studies, targeted traits changed by **d = 0.22** from pre to post (within-group, no control comparison; 95% CI 0.005–0.43). That is about five times normative change (d = 0.04) but below psychotherapy (d = 0.37). An exploratory analysis of the 4 studies with follow-ups gave d = 0.37. Change goals without a program were only weakly related to change, and some programs (e.g. vague self-made plans) produced unwanted change. | Haehner et al. 2024, *Comms Psych* |
| In the PEACH data (the same ~3-month program, N = 956), people who were more **committed** to their goal, carried out more if-then plans, and **enjoyed** them more showed more self-reported trait change and weekly and daily state change (small effects, β ≈ .07–.19). Of these three, only commitment also predicted change rated by friends, family or partners. People whose weekly states moved further from their usual level in the goal direction showed more trait change. How strongly people wanted to change, and believing personality can change, had only weak, inconsistent links (each significant on one or two of four measures): desire predicted only self-reported trait change, and belief in change predicted only observer-rated change and daily states. Most participants rated their desire high (75% at 5 or more on a 0–7 scale), which limits the range. Correlational. | Olaru et al. 2026 (online 2025), *EJP* |
| In the 3-month PEACH coaching app (N = 679 in three goal groups), weeks when people felt their strengths had become clearer, felt more able to act as they wanted, and gained insight went with more goal-consistent self-rated states that week (within-person r = .22). For emotional stability and extraversion, they also went with higher states the following week (β = .07 overall, which the authors rate as moderate for a week-to-week link); for conscientiousness they did not. The three factors correlated about .90 and were analysed as one; insight was the weakest link (r = .15 vs .27–.28; side analysis, not formally tested). Correlational and self-report only. | Allemand et al. 2024, *EJP* |
| Two 16-week student studies (N = 175 and 414; self-report). Completing emotional-stability challenges predicted growth only when people had chosen that trait themselves. Completing conscientiousness challenges predicted growth even when the trait was assigned. Other traits were not tested. | Hudson 2021, *JRP* |
| One 16-week study of college students (N = 467, of whom 105 chose agreeableness; no control group; self-report). Completing more weekly agreeableness challenges predicted gains in agreeableness. Compared with peers who completed fewer, it also went with slightly more favourable change in all three dark-triad traits: about −0.01 to −0.02 SD a month per SD more completions. For Machiavellianism, that is about −0.04 SD a month at one agreeable act a week vs −0.01 at none. Psychopathy still rose across the sample, and its effect disappeared once agreeableness change was controlled. Completing extraversion challenges predicted a small rise in narcissism, which the author says may be chance. | Hudson 2023, *J Pers* |
| Theoretical model (TESSERA): trait change builds up from many repeated everyday sequences of situation, expectation, state and reaction. | Wrzus & Roberts 2017, *PSPR* |
| **Caution:** Krämer et al. ran three preregistered online studies (combined N = 2,094). In Study 2 (N = 849), a low-intensity 3-month program (a psychoeducation reading, goal writing, weekly reminders) was compared with a waitlist (n = 175). The waitlist also improved in self-rated personality and well-being, by similar or slightly smaller amounts, and the differences were not significant (exploratory tests, possibly underpowered). In Study 3 (N = 530, no program), groups recruited to "like themselves better" improved too, while a group recruited for a study of "how consistent people are over time" did not. The authors see this as initial evidence that demand and expectancy effects, or self-selection of people who start lower followed by regression to the mean, explain a substantial part, "but perhaps not all", of the change. | Krämer et al. 2025, *JPSP* † |
| **Caution:** perceived and measured change agreed only moderately (r ≈ .49), and about 39% of responses perceived change in the wrong direction. | Hudson, Derringer & Briley 2019, *JRP* |
| **CHILL trial.** 446 analysed German-speaking adults (of 554 enrolled; 85% women, mean age 26) who wanted to be less neurotic were randomized to a 6-week app with different strategy sets, or to an active control (psychoeducation, a progress bar and support information, with no regular prompts). Self-reported neuroticism fell more than in the control (d ≈ −0.2 to −0.4) and mostly held at a follow-up about 7 weeks later. Peer ratings showed change less often: only at follow-up, on one of two measures, and in some groups. "State" strategies (e.g. relaxation, mindfulness, exercise, behavioural activation) gave larger early drops that faded unless combined with "habit" strategies. Habit strategies (e.g. rethinking thoughts, if-then goals, skill practice) started smaller but kept strengthening. Among habit strategies, the behavioural ones produced the self-reported effects; the cognitive ones did not on their own, though they were linked to peer-rated change at follow-up. None of the strategies was exposure. | Wright et al. 2026, *Psych Sci* (accepted) †; design: Haehner et al. 2025 protocol, *Personality Science* † |
| **Review:** structured programs produce small pre–post shifts toward chosen goals (citing the d = 0.22 above), and change goals are "an important but not sufficient condition". Most evidence is self-report, follow-ups are rare and affected by selective attrition, samples are mostly educated and Western, and few trials use active controls. No study has yet documented systematic adverse effects of these programs. The authors are a research network whose members wrote several of the studies reviewed. | Asselmann et al. 2026, *SPPC* |
| **Review of ten concerns:** the few randomized studies "tend to support" real but small effects. Durability rests on few follow-ups, and how often these programs backfire is unknown. Evidence on side effects is "virtually absent", and proposed contraindications (e.g. severe impairment in personality functioning, goals driven by social pressure) are "largely speculative". The authors recommend telling participants that effects are small and not fully established, and routing people to support after repeated low well-being or change in the unwanted direction. | Haehner et al. 2026, *Perspect Psychol Sci* † |

### Design principles that follow

| Principle | Strength | How the app implements it |
|---|---|---|
| Provide structure. Motivation alone is not enough. | Moderate | Goals become weekly behavioural challenges |
| If-then plans | Strong for goal attainment; moderate for trait change (note 1) | Required for every challenge |
| Completing challenges counts, not accepting them: take on only what you can complete, while staying committed to the change goal | Emerging (note 2) | Start easy; confidence check below 7/10; difficulty and count adapt to last week's completion |
| Self-monitoring | Strong for goal attainment | Daily check-offs, daily state rating, charts |
| Repeatedly acting beyond your usual level, in the goal direction, goes with more trait change. That this then becomes habit is theory, not tested. | Emerging (note 3) | Completed challenges are suggested again; the 12-week horizon |
| Strengths, feeling able to act, and insight (these rose together; insight looked weakest in an untested side analysis); enjoyment | Emerging (note 4) | Weekly reflection asks what went well and which strengths you used, then turns obstacles into if-then plans; enjoyment ratings steer suggestions |
| Self-chosen target trait | Emerging (note 5) | The user picks their own goals |
| Honest expectations | Strong (methodological) (note 6) | Science page caveats, including that self-rated scores can rise without any program; re-measurement rather than "do you feel different?"; observer ratings are the recommended next feature |

Notes:
1. **If-then plans.** A meta-analysis supports them for goal attainment (Gollwitzer & Sheeran 2006, d = 0.65). For trait change the evidence is thinner and mixed. In Hudson & Fraley 2015 Study 2 (151 students, randomized), coaching in concrete small steps plus if-then plans sped desired change in three of five traits. The two were coached together, so their separate effects are unknown. In PEACH, carrying out more if-then plans went with more change (Olaru et al. 2026, correlational; self-reported traits and states only). In CHILL, a cognitive habit package that included if-then goal setting produced no self-reported change on its own, though it was linked to peer-rated change at follow-up (Wright et al. 2026).
2. **Completion.** The evidence is one correlational, self-report study with no control group (Hudson et al. 2019). The confidence check, the thresholds (80% completion to suggest Medium, 50% to step down), keeping Stretch opt-in and the adaptive count are app choices. Hudson et al.'s own adaptive suggestions were not tested, and harder challenges did not reliably produce more growth. In PEACH, easier if-then plans went with more goal-consistent states but did not predict trait change (Olaru et al. 2026). There, commitment to the goal was the most consistent predictor of change; that is different from the number of challenges accepted.
3. **Practice and habit.** In PEACH, people whose weekly states moved further from their pre-test level in the goal direction showed more trait change (Olaru et al. 2026), and self-rated weekly states in the targeted trait rose over 11 weeks of coaching (Allemand et al. 2024; conscientiousness gains came early). These links are correlational. During the 4-week waitlist, scores did not change significantly, yet weekly states and self-reported traits showed a similar link to the one seen during the program (Olaru et al. 2026, p. 683). No cited study measured habit or automaticity; the habit step comes from theory (Wrzus & Roberts 2017). The Emerging rating reflects that the direct evidence is correlational. Randomized trials of practice-based packages (PEACH; Hudson & Fraley 2015 Study 2) found small effects but could not show which component, practice included, drove them.
4. **Strengths, insight, enjoyment.** Allemand et al. 2024 measured how people felt (strengths clearer, more able to act, more insight), not practice actually done. Enjoyment comes from Olaru et al. 2026. No study tested whether starting reflection from strengths helps.
5. **Self-chosen trait.** Hudson 2021 varied whether people chose the target trait; in every condition they picked their own weekly challenges. Choice mattered for emotional stability but not for conscientiousness. Extraversion, agreeableness and openness were not tested (two non-preregistered student studies, self-report).
6. **Honest expectations.** Re-measuring guards against misjudging one's own change (Hudson, Derringer & Briley 2019), but not against expectation effects. In Krämer et al. 2025, waitlist participants' re-measured questionnaire scores moved in the desired direction by about 0.07–0.13 points on a 1–5 scale with no program, possibly through expectations, demand or self-selection.

---

## 2. How big is the change, who changes most, and in what order?

This section answers three questions with figures checked against the full texts (October 2026).

### How big is the change?
| Benchmark | Figure | Source |
|---|---|---|
| Average volitional-change program, before vs after (7 studies; pre–post within program groups, no control) | d = 0.22 (95% CI 0.005–0.43) over about 10 weeks (range 2–16) | Haehner et al. 2024 |
| Natural trait change over the same interval | d = 0.04, so programs are roughly 5× faster (rough cross-study comparison) | Haehner et al. 2024 |
| Wanting to change without a program, about 3 months | d = 0.14 | Haehner et al. 2024 |
| Psychotherapy (mostly clinical samples) | d = 0.37 overall; emotional stability ES ≈ 0.57 (about 0.4 after bias correction), about half the ~1 SD rise from young adulthood to midlife | Haehner et al. 2024; Roberts et al. 2017 |
| Best-controlled app trial (CHILL, active control, neuroticism) | d = −0.24 self-reported, similar to psychotherapy in non-clinical samples (\|d\| = 0.26); peers saw change only at follow-up | Wright et al. 2026 |
| People who chose emotional stability and completed many challenges (+1 SD, ~7.7 a week) | +0.42 SD over about 4 months (model-predicted; self-selected completion; self-report) | Hudson 2021 |
| Concrete if-then coaching, people wanting more extraversion | 0.45 vs 0.21 SD over a semester (self-rated; one study, unreplicated) | Hudson & Fraley 2015 |

**Do other people see it?** Partly. In PEACH, friends, family and partners rated significant increases (d = 0.35 vs 0.52 self-reported) but not decreases (d = −0.22 vs −0.58), and observer data were sparse. A later analysis of a related PEACH sample, pooling all goals, found much smaller observer change (d = 0.07 vs 0.31 self-reported). In CHILL, peers saw a reduction in neuroticism only at follow-up, on one of two measures. Others notice calmer emotions less, and later (Stieger et al. 2021; Olaru et al. 2026; Wright et al. 2026).

**Is it just expectation?** Not only. In a low-intensity program, a waitlist changed almost as much as the intervention groups, which points to demand, expectancy and who signs up (Krämer et al. 2025). But in a behaviour-based program, students who were secretly given another trait's challenges did not grow in the trait they had chosen as they did more of them, which casts doubt on a pure expectancy explanation (Hudson 2021; self-report only).

**How the app says it.** The Welcome page leads with what is true and motivating, then gives one plain "what to expect" note:
- *Faster than waiting:* "On average, structured programs produced about five times the change that happens naturally over the same months." This is Haehner et al.'s (2024) own comparison of the pooled program effect (d = 0.22, CI 0.005–0.43, self-report, no control) with normative change (d = 0.04). It is a program average, so the app does **not** say "people who commit change five times faster": no source supports that. Commitment predicted change at β = .07–.10 (Olaru et al. 2026).
- *Change that lasts:* follow-up effects were d = 0.37 in 4 studies, up to 12 months (Haehner et al. 2024, exploratory); in PEACH's one-year follow-up, people who had chosen to lower neuroticism kept improving, among the 10% who answered (Stieger et al. 2024).
- *In your hands:* commitment and completed practice predicted change (Olaru et al. 2026); a group's average age and gender mix did not (Roberts et al. 2017); students who chose emotional stability and completed about 7.7 challenges a week were predicted to gain 0.42 SD in about 4 months, and those completing about 2 a week nothing (Hudson 2021, self-report).
- *Worth the effort:* trait-outcome associations are "on par or even surpass" cognitive ability and socioeconomic status (Roberts et al. 2007, as summarised by Haehner et al. 2026 and Asselmann et al. 2026). These are associations of trait levels; for changes, only self-esteem and life satisfaction have been shown to rise with intervention-related trait change so far, both in PEACH data (Allemand et al. 2024 in *Consulting Psychology Journal*, a different paper from the *EJP* study cited above; Olaru et al. 2023). The app cites only the life-satisfaction finding, whose full paper is in its reference list. The app says "IQ or income and education" because Roberts et al.'s socioeconomic status included adults' own education and income.
- *Others notice:* PEACH observers confirmed increases (Stieger et al. 2021).

A 2025 critical review recommends telling participants that effects are not fully established and expected to be relatively small (Haehner et al. 2026). The app instead states the effects in context and keeps the self-report caveat in "What to expect", because credibility and positive expectations predicted adherence in internet self-help (Alfonsson et al. 2016; Boettcher et al. 2013; correlational, abstracts only) while belief that personality can change did not predict engagement in PEACH (r = .02; Olaru et al. 2026).

### Who changes most?
Studies haven't identified a personality type that changes more, though few have looked. What went with change was what people did.
- **Not fixed characteristics.** Across 207 intervention studies, mostly therapy, a group's average age and gender mix did not predict how much it changed, and clinical and non-clinical groups gained similarly against controls (Roberts et al. 2017). People lower on a trait tended to want to change it more (average r ≈ −.29); controlling for starting level did not change the goal–growth link (Hudson & Fraley 2015).
- **Which trait matters a little.** Goals predicted more self-rated growth in extraversion and emotional stability than in agreeableness and openness: about 0.14–0.18 SD of extra growth for a strong goal, versus 0.04–0.05 SD (Hudson et al. 2020; correlational, student samples).
- **Behaviours matter most.** In a preregistered study of 956 people (281 with observer ratings), commitment to the goal was the only predictor linked to change on all four outcomes, including observer ratings (β = .07–.10). Completing more if-then plans (β = .11–.18) and enjoying them (β = .10–.15) predicted self-rated and daily change, but not observer-rated change (Olaru et al. 2026). Completing challenges predicted growth; accepting them without completing predicted small relative declines (Hudson et al. 2019). For emotional stability, practice only went with growth when people had chosen that goal (Hudson 2021).
- **Weak or null:** how much people wanted to change predicted only self-reported change, and weakly. Expected attainability predicted nothing, though this self-selected sample varied little on it (Olaru et al. 2026). Without a program, wanting to change mostly did not predict change (Baranski et al. 2020).
- **Retention, not change:** more conscientious students completed more weekly surveys (r = .19; Hudson et al. 2020). In CHILL, people who stayed already scored higher in conscientiousness and openness at the start (Wright et al. 2026). Neither study tested whether baseline traits predict how much people change.
- **One fixed limit:** in a week-long trial, the most introverted participants did not increase their in-the-moment extraverted behaviour and reported costs (Jacques-Hamilton et al. 2019, exploratory).

So the "type who improves best" is described by behaviour, not fixed traits: someone who picks their own goal, commits to it, makes small concrete plans, does them most weeks, and enjoys them. Planning can be taught (Hudson & Fraley 2015); whether commitment and enjoyment can be trained is untested. The app's stepwise path is built around these behaviours.

### Is there an order?
None of the studies we reviewed tested an order across traits, for example building emotional stability or conscientiousness first to make other traits easier. Change from practice mostly stayed in the targeted trait (Hudson et al. 2019; exploratory, self-report). Making emotional stability a compulsory first step would conflict with the finding that it only changed when chosen (Hudson 2021). Within one trait, the evidence suggests:
- In therapy studies, programs under about 4 weeks showed small effects and those beyond about 8 weeks little extra (between-study, tentative; Roberts et al. 2017).
- Quick "state" strategies gave faster drops in neuroticism that faded; habit strategies built slowly and kept improving after the program. Combining both gave large, mostly lasting self-reported drops, but by follow-up usually no better than habit strategies alone (Wright et al. 2026).
- PEACH gave everyone with the same goal its parts in one fixed order, and the authors called for trials testing order, difficulty and type of component (Stieger et al. 2021).

**The app's path:** (1) choose one trait and commit; (2) small, sure steps with if-then plans; (3) build habits through repetition and enjoyment; (4) consolidate, retake and re-check the goal, then optionally add a second trait; (5) maintain. Steps 1–3 target things that went with more change in studies (small, correlational links, mostly in self-ratings), and step 5 follows the long-term follow-up studies. Working on one trait matches PEACH (one primary change goal) and Hudson 2021, but no study has compared it with working on several at once. The consolidation step and the order are the app's own design choices and haven't been tested.

---

## 3. Can conscientiousness be built first to limit dropout?

**Short answer: not in a tested way.** No study has raised conscientiousness first and then measured dropout (or change) in a later program, and no trial has randomized the order of trait modules. Checked October 2026 (local full texts plus web abstracts; web sources marked †).

| Question | What the evidence says | Source |
|---|---|---|
| Does lower C predict dropout? | Modestly and not always. Weekly waves completed: r = .19 (12 pooled student samples), .20, .22 (one of two studies), .29. PEACH posttest completers: d = 0.15 self, 0.29 observer; one-year responders d = 0.27. CHILL completers d = 0.31–0.47. No C difference in a no-intervention study. | Hudson et al. 2020, 2019; Hudson 2021, 2023; Olaru et al. 2024; Stieger et al. 2024; Wright et al. 2026; Baranski et al. 2020 |
| Can C be raised by practice? | Often, by self-report. C challenges predicted C growth even when the trait was assigned or the person didn't know it was the target (Hudson 2021, two studies), but not in a third sample (Hudson 2023, b = .00). A 2-week self-discipline SMS program raised self-discipline (0.34 vs 0.10) and observers noticed (non-randomized). PEACH C-goal users changed vs waitlist and observers confirmed it. A 2025 review counted 9 of 11 post-2017 interventions raising C (abstract only). | Hudson 2021, 2023; Stieger et al. 2020, 2021; Turner & Hodis 2025 † |
| Do people who choose C drop out more? | Not in PEACH: C-goal choosers started far lower in C (d ≈ 0.95–1.19) yet 35% reached posttest vs 37% of others (our calculation from descriptive tables; untested). | Stieger et al. 2024; Olaru et al. 2024 |
| Does "willpower training" help? | Weakly at best: g = 0.30, shrinking to about .13–.24 after bias correction; a 6-week RCT found no effect. | Friese et al. 2017 †; Miles et al. 2016 † |
| Do low-C people benefit more from plans? | Mixed: if-then plans raised class attendance mainly in low/moderate-C students (Webb et al. 2007 †), but a later trial found the opposite (Elliott et al. 2024 †) and another found no moderation (Ajzen et al. 2009 †). | as listed |
| What reduces dropout in apps? | Between-trial associations: reminders, payment and in-person/phone enrolment went with lower attrition across 70 RCTs (Linardon & Fuller-Tyszkiewicz 2020 †; a 2026 student-app review found no reminder link). Human guidance raised completion (g = 0.29; ~12 points more completers; Musiat et al. 2022 †). Push prompts had small, short-lived effects (Bidargaddi et al. 2018 †). Rewarding a return after a missed workout was the top nudge in a 54-arm gym megastudy (Milkman et al. 2021 †). | as listed |

**What the app does.** It lends structure instead of asking users to fix conscientiousness first: a follow-through kit on Today (a daily calendar reminder as an .ics file, a ready-made message asking someone to check in, and an if-then plan for missed days), opened by default for people scoring at or below 2.8 on IPIP conscientiousness during the small-steps stage; a "welcome back" tip after two or more missed days; and, on the Goals page, a note for low-C users that conscientiousness is a reasonable first goal if follow-through is their main struggle, while still asking them to pick what matters most. Building C first as a required step is not used: it is untested, would delay the goal people chose, and choosing the goal mattered for emotional stability (Hudson 2021).

---

## 4. Techniques by trait

Ratings:
- **Strong:** consistent benefits across multiple RCTs or meta-analyses.
- **Moderate:** RCT support, but effects are small, mixed, or mostly measured against weak controls.
- **Emerging:** early, lab-based, correlational or single-study evidence.

The **outcome** column matters. Most techniques were tested on outcomes close to a trait, not on the trait score itself.

### Emotional stability (reducing neuroticism)
Of the five traits, emotional stability (low neuroticism) changes most during interventions, mostly therapy and medication in clinical samples, followed by extraversion (Roberts et al. 2017).
- **Unified Protocol (UP).** In adults with anxiety disorders, 12–16 sessions of therapist-led UP CBT left people with lower self-reported neuroticism at week 16 than a waitlist (d = −0.43) or standard disorder-specific CBT (d = −0.32). The advantage over standard CBT held after accounting for changes in anxiety and depression (d = −0.42). Standard CBT did not lower neuroticism more than the waitlist. This was a secondary analysis of one trial, with no follow-up (Sauer-Zavala et al. 2021).
- **UP vs other active treatments.** A later trial compared group UP with usual care (medication or non-manualized CBT; Osma et al. 2022, N = 488, as summarized by Lorenzo-Luaces 2023). It found a very small, non-significant difference in neuroticism (d = 0.09; UP not reliably better). Pooling the two trials, UP's extra effect on neuroticism over other CBTs was small and not significant (d = −0.14, 95% CI −0.30 to 0.01; Lorenzo-Luaces 2023, a commentary). So it is unclear how much UP adds beyond other active treatments.
- **Nonclinical app users.** In the CHILL trial, a 6-week app lowered self-reported neuroticism more than an active control (Wright et al. 2026; see section 1).

| Technique | Rating | Outcome | Key evidence |
|---|---|---|---|
| Behavioural activation | Strong | Depression | Ekers et al. 2014 (26 RCTs, SMD −0.74); Furukawa et al. 2021 (a helpful ingredient in iCBT) |
| Physical activity | Strong | Depression, anxiety, distress | Singh et al. 2023 (1,039 trials; about −0.4 to −0.6) |
| Mindfulness | Strong for anxiety and depression; moderate for neuroticism | Anxiety and depression (small); neuroticism | Goyal et al. 2014; Linardon et al. 2024 (apps, g ≈ 0.25); Almenräder et al. 2024: 45 studies (39 RCTs, N = 2,913), all self-report, 35 of 45 used a proxy (34 trait anxiety or worry, 1 negative affect). Mindfulness-programme pre–post neuroticism d = 0.67 in the model's reference group of psychiatric samples (less in non-psychiatric samples), versus 0.25 on waitlist/usual care and 0.62 with other active therapies (only 6 studies); d = 0.25 after small-study correction. Programmes were mostly 8 weeks; brief inductions were excluded |
| Graded exposure / approach | Strong (in CBT) | Anxiety | Carpenter et al. 2018 (g = 0.56 vs placebo) |
| Self-compassion | Moderate | Rumination, stress, depression, anxiety | Ferrari et al. 2019 (27 RCTs, mostly vs waitlist) |
| Cognitive reappraisal | Moderate | Momentary emotion | Webb et al. 2012. Added little alone in iCBT (Furukawa 2021) |
| Worry postponement | Moderate | Daily worry duration and frequency (small: d ≈ 0.31 and 0.19 vs just logging worries; 6–28 days; no follow-up) | McGowan & Behar 2013; Dippel et al. 2024 (7 randomized trials, N = 999) |
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

**Costs:** in a 1-week RCT of 147 adults, acting extraverted raised positive mood and authenticity compared with a sham group, with no costs on average. More introverted participants gained less positive mood, and the most introverted reported more tiredness, more negative mood and feeling less authentic. These moderation results are tentative because the study was not powered for them. Well-being differences were gone 2 weeks after the week ended (Jacques-Hamilton et al. 2019). Others found few costs (Margolis 2020; van Allen 2021). In one diary study, extraverted behaviour predicted fatigue about 3 hours later (Leikas & Ilmarinen 2017), but Jacques-Hamilton et al. did not replicate this. So the app suggests planning recharge time after bigger social challenges.

### Agreeableness
No verified study shows change in *trait* agreeableness from these specific techniques alone. In one study of general weekly agreeableness challenges, completing more of them predicted small self-reported gains in agreeableness and small drops in dark traits relative to peers (Hudson 2023; correlational, college students).

| Technique | Rating | Outcome | Key evidence |
|---|---|---|---|
| Loving-kindness / compassion meditation | Strong | Compassion, positive emotion; prosocial behaviour (small–moderate) | Galante et al. 2014; Kirby et al. 2017; Luberto et al. 2018 |
| Acts of kindness / prosocial spending | Moderate | Giver's well-being (δ = 0.28) | Curry et al. 2018; Dunn et al. 2008 |
| Gratitude expression | Moderate | Well-being (small) | Davis et al. 2016; Seligman et al. 2005 |
| Forgiveness (REACH) | Moderate | Forgiveness of a specific hurt; depression, anxiety and hope (fewer studies) | Wade et al. 2014 (see note) |
| Perspective-taking | Emerging | Anger and negative emotion | Webb et al. 2012 |
| Responsive listening / active-constructive responding | Emerging | Relationship quality (correlational) | Gable et al. 2004 |

**Forgiveness note.** Wade et al. 2014 pooled 54 reports of in-person, facilitator-led programs, mostly groups; self-help formats were excluded, so self-guided use like this app's is untested. Across all forgiveness models, δ = 0.56 vs no treatment and 0.45 vs alternative treatments. REACH-model programs alone gave 0.35 vs no treatment and 0.17 vs alternatives (not significant). REACH programs were short (mean 5.6 hours), and the gap between models disappeared once hours and format were controlled. Longer programs had larger effects (a between-study link). Depression, anxiety and hope improved vs no treatment in 6–10 studies.

### Openness
Few studies have tried to change openness, and the trait-level results are weak. Every technique aimed only at openness is rated *emerging*; the general techniques that cover all five traits (trait practice, if-then plans) keep their own ratings.
- In one randomized trial of adults aged 60–94, 16 weeks of reasoning training plus crosswords and Sudoku (at least 10 hours a week) raised self-reported openness compared with a waitlist (d = .39). The study could not separate the training from the puzzles (Jackson et al. 2012).
- In a 2-week text-message program, people who chose to work on openness raised one narrow facet, openness to action, by self-report and by close others' reports, but their overall openness did not change. Only 66 people across two studies chose openness; groups were self-selected, and follow-up lasted at most 6 weeks (Stieger et al. 2020).
- In student studies, goal and challenge effects were weakest or absent for openness (Hudson & Fraley 2015; Hudson et al. 2019 and 2020).

| Technique | Rating | Outcome | Key evidence |
|---|---|---|---|
| Novelty / openness-to-action practice | Emerging | Openness-to-action facet | Stieger et al. 2020 |
| Reasoning training + puzzles | Emerging | Self-reported openness (older adults, 1 RCT vs waitlist) | Jackson et al. 2012 |
| Awe walks | Emerging | Awe, prosocial emotion | Sturm et al. 2020 |
| Literary fiction | Emerging | Self-reported trait change (either direction) | Djikic et al. 2009 |

---

## 5. Measurement

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

## 6. Safety

- Self-guided digital CBT helps mild symptoms. Guided or professional care works better for moderate or severe symptoms (Karyotaki et al. 2021). In trials, users of self-guided iCBT were less likely to deteriorate than controls (5.8% vs 9.1%; Karyotaki et al. 2018, *Psychol Med*).
- For personality-change programs themselves, no study has documented systematic adverse effects, but evidence on side effects is "virtually absent". Reviews recommend telling users that effects are small, monitoring well-being, and routing people to support when it stays low (Haehner et al. 2026; Asselmann et al. 2026).
- The app is always non-diagnostic and shows crisis resources in the footer and Settings: 988 call or text in the US, Crisis Text Line (text HOME to 741741), and findahelpline.com internationally.
- Support prompts appear after a positive PHQ-4 screen (for 14 days) and after 2–3 days of mood ratings at or below 2 out of 7.
- Increasing neuroticism is not offered as a goal (as in PEACH).

---

## 7. Open questions worth tracking

- **Active controls.** Few trials randomize people to an active control that lacks the program's key ingredients, and waitlist controls can overstate effects. The CHILL app beat a minimal active control (psychoeducation, progress feedback and support information) on self-reported neuroticism (Wright et al. 2026), but that control got no regular prompts. Beating active controls that lack the key ingredients has rarely been tested (Asselmann et al. 2026). Reviews call for randomized trials with clearly defined active controls, blinding and fidelity checks (Asselmann et al. 2026, *SPPC*). Haehner et al. 2026 note that the few randomized studies so far "tend to support" real effects ("Ten concerns about volitional personality-change interventions—and how to address them", *Perspectives on Psychological Science*, https://doi.org/10.1177/17456916261466950; checked against the October 2025 preprint). See also Krämer et al. 2025.
- **Long-term durability** beyond one year. Only four studies in the 2024 meta-analysis had any follow-up (Haehner et al. 2024), and the PEACH 1-year data cover 10% of participants.
- **Diverse samples.** Most studies used students or motivated volunteers from Western countries.
- **Informant and behavioural outcomes**, not just self-report (Asselmann et al. 2026, *SPPC*).
- **Ethics** of personality optimisation: pressure to conform, and whether some trait levels come to be seen as "better" (Haehner et al. 2026; Asselmann et al. 2026).
