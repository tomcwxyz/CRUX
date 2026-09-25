"use client";

import { useId, type ReactNode } from "react";
import type { Audience, ReaderCase, ReaderClaim, ReaderModel, ReaderStep } from "../lib/reader-model";
import styles from "./crux-reader.module.css";

type Question = "where" | "power" | "believe" | "happened";

type CruxReaderProps = {
  model: ReaderModel;
  /** Shows the audience switch. Omit when the page provides its own tabs. */
  onAudienceChange?: (audience: Audience) => void;
  /** Audiences that can be chosen; others are shown disabled (e.g. for an invalid draft). */
  availableAudiences?: Audience[];
  /** Page-specific actions, rendered above the record. */
  toolbar?: ReactNode;
  /** Page-specific message, rendered above the record. */
  note?: ReactNode;
  /** Optional "What to notice" guidance for a worked example. */
  teaching?: Partial<Record<Question, string>>;
};

const audienceCopy: Record<Audience, { label: string; job: string; intro: string; kicker: string }> = {
  internal: {
    label: "Internal",
    job: "Scrutinise & improve",
    intro: "Evidence, gaps and operational detail for the people responsible for the system.",
    kicker: "internal view",
  },
  public: {
    label: "Public",
    job: "Understand the system",
    intro: "A short explanation of where AI is used, what it can do and who remains responsible.",
    kicker: "public explanation",
  },
  affected_party: {
    label: "Affected person",
    job: "Understand my case",
    intro: "What AI did in this case, who made the decision and how to ask questions or challenge it.",
    kicker: "explanation for the person affected",
  },
};

const audiences: Audience[] = ["internal", "public", "affected_party"];

const questions: Array<{ id: Question; number: string; title: string; copy: string }> = [
  { id: "where", number: "01", title: "Where is AI involved?", copy: "Follow the real-world process. AI should appear as one step in the work, not the whole story." },
  { id: "power", number: "02", title: "What power does it have?", copy: "What AI can influence or cause, and where human authority sits before anything consequential happens." },
  { id: "believe", number: "03", title: "Why should I believe this?", copy: "What the organisation says, kept separate from the evidence someone can actually inspect." },
  { id: "happened", number: "04", title: "What happened here?", copy: "A particular case is different from the general description: what AI contributed, who acted and what followed." },
];

export function CruxReader({ model, onAudienceChange, availableAudiences = audiences, toolbar, note, teaching }: CruxReaderProps) {
  const anchor = useId().replace(/:/g, "");
  const sectionId = (question: Question) => `${anchor}-${question}`;
  const copy = audienceCopy[model.audience];
  const affected = model.audience === "affected_party";

  const section = (question: Question, body: ReactNode) => {
    const meta = questions.find((item) => item.id === question)!;
    return (
      <section className={styles.section} id={sectionId(question)} key={question} aria-labelledby={`${sectionId(question)}-title`}>
        <header className={styles.questionHeading}>
          <span aria-hidden="true">{meta.number}</span>
          <div>
            <h3 id={`${sectionId(question)}-title`}>{meta.title}</h3>
            <p>{meta.copy}</p>
          </div>
        </header>
        {teaching?.[question] ? <p className={styles.teaching}><strong>What to notice</strong><span>{teaching[question]}</span></p> : null}
        {body}
      </section>
    );
  };

  const where = section("where", <WhereSection model={model} />);
  const power = section("power", <PowerSection model={model} />);
  const believe = section("believe", <BelieveSection model={model} />);
  const happened = section("happened", <HappenedSection model={model} />);

  return (
    <section className={styles.reader} aria-label="CRUX record">
      {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}

      {onAudienceChange ? (
        <div className={styles.audienceSwitch} role="group" aria-label="Read as">
          {audiences.map((audience) => (
            <button
              key={audience}
              type="button"
              className={styles.audienceChoice}
              aria-pressed={model.audience === audience}
              disabled={!availableAudiences.includes(audience)}
              onClick={() => onAudienceChange(audience)}
            >
              <span>{audienceCopy[audience].label}</span>
              <strong>{audienceCopy[audience].job}</strong>
              <small>{audienceCopy[audience].intro}</small>
            </button>
          ))}
        </div>
      ) : null}

      {note ? <div className={styles.note}>{note}</div> : null}

      {model.availability !== "ready" || !model.use ? (
        <div className={styles.canvas}>
          <div className={styles.unknown}>
            <strong>{model.availability === "use_not_included" ? `This AI use is not included in the ${copy.label.toLowerCase()} view.` : "No AI use has been described in this record yet."}</strong>
            <p>{model.availability === "use_not_included" ? "The organisation has not disclosed it at this level. Nothing else has been shown in its place." : "Describe one real use of AI to see how it reads."}</p>
          </div>
        </div>
      ) : (
        <div className={styles.canvas}>
          <header className={styles.summary}>
            <div>
              <div className={styles.kicker}>{model.organisation} · {copy.kicker}</div>
              <h2>{affected ? "How AI was involved in this case" : model.use.name}</h2>
              <p className={styles.summaryCopy}>{model.use.summary ?? "No plain-language explanation has been recorded yet."}</p>
              <div className={styles.flags}>
                {model.use.consequential
                  ? <span className={styles.flagImpact}>May materially affect people</span>
                  : <span className={styles.flagQuiet}>Low consequence</span>}
                {model.use.peopleAffected.length ? <span className={styles.flag}>Affects: {model.use.peopleAffected.join(", ")}</span> : null}
              </div>
            </div>
            <dl className={styles.facts} aria-label="Short answer">
              <div><dt>AI's role</dt><dd>{model.aiCan.join(" · ") || "Not recorded"}</dd></div>
              <div><dt>Human checkpoint</dt><dd>{model.humanCheckpoint ?? "Not recorded"}</dd></div>
              <div><dt>Can AI cause an action by itself?</dt><dd>{model.canActAlone}</dd></div>
            </dl>
          </header>

          <nav className={styles.jump} aria-label="Reading path">
            {(affected ? [questions[3]!, ...questions.slice(0, 3)] : questions).map((question) => (
              <a key={question.id} href={`#${sectionId(question.id)}`}><span>{question.number}</span>{question.title}</a>
            ))}
          </nav>

          {affected ? (
            <>
              {happened}
              <details className={styles.fold}>
                <summary>About the wider AI process</summary>
                {where}{power}{believe}
              </details>
            </>
          ) : (
            <>{where}{power}{believe}{happened}</>
          )}

          {model.audience === "internal" ? <InternalDetail model={model} /> : null}
        </div>
      )}
    </section>
  );
}

function Unknown({ title, children }: { title: string; children?: ReactNode }) {
  return <div className={styles.unknown}><strong>{title}</strong>{children ? <p>{children}</p> : null}</div>;
}

function WhereSection({ model }: { model: ReaderModel }) {
  if (!model.process) return <Unknown title="The process is not known yet.">No process steps are visible in this view.</Unknown>;
  return (
    <>
      <div className={styles.processIntro}>
        <div className={styles.kicker}>The process</div>
        <h4>{model.process.name}</h4>
        {model.process.description ? <p>{model.process.description}</p> : null}
      </div>
      {model.process.steps.length ? <Flow steps={model.process.steps} /> : <Unknown title="No process steps are visible in this view." />}
    </>
  );
}

function Flow({ steps }: { steps: ReaderStep[] }) {
  return (
    <ol className={styles.flow}>
      {steps.map((step, index) => (
        <li key={step.id} className={styles.flowItem}>
          {index > 0 ? (
            step.aiStopsBefore
              ? <span className={styles.boundary}>AI stops here</span>
              : <span className={styles.arrow} aria-hidden="true">→</span>
          ) : null}
          <article className={`${styles.step} ${styles[`step_${step.role}`] ?? ""}`}>
            <span>{step.roleLabel}</span>
            <strong>{step.name}</strong>
            {step.description ? <small>{step.description}</small> : null}
          </article>
        </li>
      ))}
    </ol>
  );
}

function PowerSection({ model }: { model: ReaderModel }) {
  return (
    <>
      <div className={styles.twoColumn}>
        <article className={styles.card}>
          <div className={styles.kicker}>AI can</div>
          {model.aiCan.length ? model.aiCan.map((item) => <div className={styles.powerLine} key={item}>{item}</div>) : <Unknown title="What AI does is not recorded." />}
          <div className={styles.cardSubhead}>Can it cause an action by itself?</div>
          <div className={styles.powerLine}>{model.canActAlone}</div>
        </article>
        <article className={styles.card}>
          <div className={styles.kicker}>Human authority</div>
          {model.decisions.length ? model.decisions.map((decision) => (
            <div className={styles.authorityLine} key={decision.id}>
              <strong>{decision.name}</strong>
              <span>Decided by: {decision.authority}</span>
              <span>{decision.reviewBeforeEffect ? "A person reviews before it takes effect" : "No review before it takes effect is recorded"}</span>
            </div>
          )) : <Unknown title="Decision authority is not recorded.">That may be appropriate for a simple assistive use, or it may be a gap worth resolving.</Unknown>}
        </article>
      </div>
      {model.actions.length ? (
        <article className={`${styles.card} ${styles.spaced}`}>
          <div className={styles.kicker}>Actions connected to this AI use</div>
          {model.actions.map((action) => (
            <div className={styles.action} key={action.id}>
              <div><strong>{action.name}</strong><span>{action.scope}</span></div>
              <div className={styles.flags}>
                <span className={styles.flag}>Started by: {action.startedBy}</span>
                <span className={styles.flag}>{action.approval}</span>
                <span className={styles.flag}>{action.reversibility}</span>
              </div>
            </div>
          ))}
        </article>
      ) : null}
    </>
  );
}

function BelieveSection({ model }: { model: ReaderModel }) {
  return (
    <>
      {model.claims.length
        ? model.claims.map((claim) => <ClaimStack claim={claim} audience={model.audience} key={claim.id} />)
        : <Unknown title="No statement is visible to compare with evidence." />}
      {model.unknowns.length ? (
        <div className={styles.stack}>
          {model.unknowns.map((item) => (
            <div className={`${styles.row} ${styles.unknownRow}`} key={item}>
              <Label tone="unknown" text="UNKNOWN" hint="Not known or not disclosed" />
              <div><strong>{item}</strong></div>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function ClaimStack({ claim, audience }: { claim: ReaderClaim; audience: Audience }) {
  return (
    <article className={styles.stack}>
      <div className={`${styles.row} ${styles.saysRow}`}>
        <Label tone="says" text="SAYS" hint="What the organisation says" />
        <div><strong>{claim.statement}</strong></div>
      </div>
      {claim.evidence.length ? claim.evidence.map((evidence) => (
        <div className={`${styles.row} ${styles.showsRow}`} key={evidence.id}>
          <Label tone="shows" text="SHOWS" hint="Evidence we can inspect" />
          <div>
            <strong>{evidence.summary}</strong>
            <p><span className={evidence.tone === "supports" ? styles.supports : styles.caution}>{evidence.tone === "supports" ? "✓" : "△"} {evidence.relationship}</span> · {evidence.kind}</p>
            {evidence.limitations.length ? <p className={styles.caution}>Limitation: {evidence.limitations.join(" · ")}</p> : null}
            {evidence.sourceUrl ? <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">Open source reference ↗</a> : null}
          </div>
        </div>
      )) : (
        <div className={`${styles.row} ${styles.unknownRow}`}>
          <Label tone="unknown" text="UNKNOWN" hint="No evidence yet" />
          <div>
            <strong>{audience === "internal" ? "No evidence is linked yet." : "No evidence is visible in this view."}</strong>
            <p>This is still a statement, not evidence. CRUX leaves that gap visible.</p>
          </div>
        </div>
      )}
    </article>
  );
}

function HappenedSection({ model }: { model: ReaderModel }) {
  if (model.cases.length) return <>{model.cases.map((item) => <CaseStack key={item.id} item={item} />)}</>;
  if (model.audience === "public") return <Unknown title="Specific cases are explained only to the people they affect.">The general process above still applies to every case.</Unknown>;
  if (model.audience === "affected_party") return <Unknown title="No record of this particular case is visible yet." />;
  if (model.use?.consequential) return <Unknown title="No particular case is recorded yet.">The general process can still be understood, but nothing here yet shows what happened in practice.</Unknown>;
  return (
    <article className={styles.card}>
      <div className={styles.kicker}>Proportionate by default</div>
      <h4>A case record is not necessary for every ordinary AI use.</h4>
      <p className={styles.muted}>For a low-consequence assistive use, CRUX can stop with a clear description of the process, power and evidence. A specific case becomes useful when consequence, dispute, incident or learning makes it worth inspecting.</p>
    </article>
  );
}

function CaseStack({ item }: { item: ReaderCase }) {
  return (
    <article className={styles.stack}>
      <div className={`${styles.row} ${styles.happenedRow}`}>
        <Label tone="happened" text="HAPPENED" hint="A particular case" />
        <div><strong>{item.outcome}</strong><p>The outcome in this case.</p></div>
      </div>
      <ol className={styles.caseFlow}>
        <li className={styles.step_ai}><span>AI</span><strong>{item.aiContribution}</strong></li>
        <li><span>What happened next</span><strong>{item.effect}</strong></li>
        <li className={styles.step_person}><span>Person</span><strong>{item.person ?? "No human involvement is recorded."}</strong></li>
        <li><span>Outcome</span><strong>{item.outcome}</strong></li>
      </ol>
      <div className={styles.caseFooter}>
        <div className={styles.finalAuthority}><span>Who had final authority?</span><strong>{item.finalAuthority}</strong></div>
        <div className={styles.challenge}>
          <span>Questions or concerns?</span>
          <strong>{item.challenge ? item.challenge.text : "No way to question or challenge this is recorded."}</strong>
          {item.challenge?.uri && item.challenge.uri !== item.challenge.text ? <a href={item.challenge.uri} target="_blank" rel="noreferrer">Open challenge route ↗</a> : null}
        </div>
      </div>
    </article>
  );
}

function InternalDetail({ model }: { model: ReaderModel }) {
  return (
    <details className={styles.fold}>
      <summary>Operational and technical detail</summary>
      <div className={styles.twoColumn}>
        <article className={styles.card}>
          <div className={styles.kicker}>System</div>
          <strong>{model.system?.name ?? "No system recorded"}</strong>
          <p className={styles.muted}>Version {model.system?.version ?? "not recorded"}</p>
        </article>
        <article className={styles.card}>
          <div className={styles.kicker}>System-reported activity</div>
          <p><strong>{model.activity?.attachedObservations ?? 0}</strong> attached runtime observation{model.activity?.attachedObservations === 1 ? "" : "s"}</p>
          <p><strong>{model.activity?.modelComparisons ?? 0}</strong> model comparison{model.activity?.modelComparisons === 1 ? "" : "s"} · <strong>{model.activity?.differencesToReview ?? 0}</strong> difference{model.activity?.differencesToReview === 1 ? "" : "s"} to review</p>
          <p className={styles.muted}>Runtime evidence can show whether the running system differs from the description. It does not decide whether it is safe or trustworthy.</p>
        </article>
      </div>
    </details>
  );
}

function Label({ tone, text, hint }: { tone: "says" | "shows" | "happened" | "unknown"; text: string; hint: string }) {
  return <div className={`${styles.label} ${styles[`label_${tone}`]}`}><b>{text}</b><span>{hint}</span></div>;
}
